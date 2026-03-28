import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import https from 'https';
import { validateRoutesConfig } from './logic/validateConfig.js';
import { getTemplateCatalog, replaceTemplateRegistry } from './logic/templateRegistry.js';
import { sequelize, Ingress, Egress, Template, RouteConfig } from './models/index.js';
import { runMigrations } from './models/db-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const nodeEnv = process.env.NODE_ENV || 'development';
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: path.join(__dirname, envFile) });

const app = express();
const webhookPathPrefix = '/webhook/';
const serveUi = process.env.SERVE_UI !== 'false';
const adminApiToken = (process.env.ADMIN_API_TOKEN || '').trim();
const adminProxySharedSecret = (process.env.ADMIN_PROXY_SHARED_SECRET || '').trim();
const frontendOnlyApi = process.env.FRONTEND_ONLY_API === 'true';
const frontendAuthEnabled = process.env.FRONTEND_AUTH_ENABLED === 'true';
const frontendAuthUsername = (process.env.FRONTEND_AUTH_USERNAME || '').trim();
const frontendAuthPassword = process.env.FRONTEND_AUTH_PASSWORD || '';
const frontendAuthSessionSecret = process.env.FRONTEND_AUTH_SESSION_SECRET || '';
const frontendAuthCookieName = 'gateherald_ui_session';
const allowedCorsOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
const parsePositiveInteger = (value, fallbackValue) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallbackValue;
  }

  return parsed;
};
const forwardRequestTimeoutMs = parsePositiveInteger(process.env.FORWARD_REQUEST_TIMEOUT_MS, 15000);
const forwardMaxConcurrent = parsePositiveInteger(process.env.FORWARD_MAX_CONCURRENT, 20);
const forwardQueueWarnThreshold = parsePositiveInteger(process.env.FORWARD_QUEUE_WARN_THRESHOLD, 250);
const frontendAuthSessionTtlMinutes = parsePositiveInteger(process.env.FRONTEND_AUTH_SESSION_TTL_MINUTES, 480);

const parseCookies = (cookieHeader = '') => {
  const cookieMap = {};

  cookieHeader
    .split(';')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .forEach((chunk) => {
      const separatorIndex = chunk.indexOf('=');
      if (separatorIndex < 1) return;

      const key = chunk.slice(0, separatorIndex).trim();
      const value = chunk.slice(separatorIndex + 1).trim();
      cookieMap[key] = decodeURIComponent(value);
    });

  return cookieMap;
};

const createFrontendSessionToken = () => {
  const expiresAt = Date.now() + (frontendAuthSessionTtlMinutes * 60 * 1000);
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', frontendAuthSessionSecret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
};

const isValidFrontendSessionToken = (token) => {
  if (!token || typeof token !== 'string') return false;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', frontendAuthSessionSecret)
    .update(payload)
    .digest('base64url');

  if (!timingSafeEquals(signature, expectedSignature)) {
    return false;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(decoded.exp) && Date.now() < decoded.exp;
  } catch {
    return false;
  }
};

const setFrontendSessionCookie = (req, res, token) => {
  const cookieParts = [
    `${frontendAuthCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${frontendAuthSessionTtlMinutes * 60}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto']
    : '';
  if (req.secure || forwardedProto.includes('https')) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
};

const clearFrontendSessionCookie = (req, res) => {
  const cookieParts = [
    `${frontendAuthCookieName}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];

  const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string'
    ? req.headers['x-forwarded-proto']
    : '';
  if (req.secure || forwardedProto.includes('https')) {
    cookieParts.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieParts.join('; '));
};

const shouldProtectWithFrontendSession = (requestPath) => {
  return requestPath.startsWith('/ui')
    || requestPath === '/api'
    || requestPath.startsWith('/api/ui')
    || requestPath.startsWith('/api/templates')
    || requestPath.startsWith('/api/configs');
};

const frontendSessionAuthMiddleware = (req, res, next) => {
  if (!serveUi || !frontendAuthEnabled) {
    next();
    return;
  }

  if (
    req.path === '/auth/login'
    || req.path === '/auth/logout'
    || req.path.startsWith(webhookPathPrefix)
    || !shouldProtectWithFrontendSession(req.path)
  ) {
    next();
    return;
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies[frontendAuthCookieName];

  if (isValidFrontendSessionToken(sessionToken)) {
    next();
    return;
  }

  if (req.path.startsWith('/api')) {
    res.status(401).json({ error: 'Login required' });
    return;
  }

  const nextTarget = encodeURIComponent(req.originalUrl || '/ui/config-builder');
  res.redirect(`/auth/login?next=${nextTarget}`);
};

const apiCorsMiddleware = (req, res, next) => {
  const requestOrigin = req.headers.origin;

  if (!requestOrigin) {
    next();
    return;
  }

  if (allowedCorsOrigins.has(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      req.headers['access-control-request-headers'] || 'Content-Type, Authorization'
    );

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  } else if (req.method === 'OPTIONS') {
    res.status(403).json({ error: 'CORS origin denied' });
    return;
  }

  next();
};

const parseJson = (value, fallbackValue) => {
  if (!value) return fallbackValue;
  try {
    return JSON.parse(value);
  } catch {
    return fallbackValue;
  }
};

const serializeJson = (value, fallbackValue) => {
  try {
    return JSON.stringify(value ?? fallbackValue);
  } catch {
    return JSON.stringify(fallbackValue);
  }
};

const normalizeMethod = (method) => (method || 'POST').toUpperCase();
const routeCacheKey = (routePath, method) => `${normalizeMethod(method)}:${routePath}`;

const timingSafeEquals = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const extractBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== 'string') return '';
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
};

const frontendApiAccessMiddleware = (req, res, next) => {
  if (!frontendOnlyApi) {
    next();
    return;
  }

  const bearerToken = extractBearerToken(req.headers.authorization);
  const headerToken = typeof req.headers['x-gateherald-admin-token'] === 'string'
    ? req.headers['x-gateherald-admin-token'].trim()
    : '';
  const proxySecret = typeof req.headers['x-gateherald-proxy-secret'] === 'string'
    ? req.headers['x-gateherald-proxy-secret'].trim()
    : '';
  const tokenAuthorized = Boolean(adminApiToken)
    && [bearerToken, headerToken].some((candidate) => candidate && timingSafeEquals(candidate, adminApiToken));
  const proxyAuthorized = Boolean(adminProxySharedSecret)
    && proxySecret
    && timingSafeEquals(proxySecret, adminProxySharedSecret);

  if (tokenAuthorized || proxyAuthorized) {
    next();
    return;
  }

  res.status(403).json({ error: 'API access is restricted to frontend/proxy requests' });
};

const adminAuthMiddleware = (req, res, next) => {
  if (!adminApiToken && !adminProxySharedSecret) {
    next();
    return;
  }

  const bearerToken = extractBearerToken(req.headers.authorization);
  const headerToken = typeof req.headers['x-gateherald-admin-token'] === 'string'
    ? req.headers['x-gateherald-admin-token'].trim()
    : '';
  const proxySecret = typeof req.headers['x-gateherald-proxy-secret'] === 'string'
    ? req.headers['x-gateherald-proxy-secret'].trim()
    : '';

  const tokenAuthorized = Boolean(adminApiToken)
    && [bearerToken, headerToken].some((candidate) => candidate && timingSafeEquals(candidate, adminApiToken));
  const proxyAuthorized = Boolean(adminProxySharedSecret)
    && proxySecret
    && timingSafeEquals(proxySecret, adminProxySharedSecret);

  if (tokenAuthorized || proxyAuthorized) {
    next();
    return;
  }

  if (adminApiToken) {
    res.setHeader('WWW-Authenticate', 'Bearer realm="gateherald-admin"');
  }

  res.status(401).json({ error: 'Admin authentication required' });
};

const sanitizeRouteModuleOptions = (moduleOptions = {}) => {
  const sanitized = { ...moduleOptions };
  delete sanitized.templateOverrides;
  return sanitized;
};

const toRoutePayloadFromModel = (record) => ({
  id: record.id,
  path: record.path,
  method: normalizeMethod(record.method),
  enabled: Boolean(record.enabled),
  moduleOptions: sanitizeRouteModuleOptions(parseJson(record.module_options_json, {})),
  headers: parseJson(record.headers_json, []),
  targets: parseJson(record.targets_json, [])
});

const toTemplatePayloadFromModel = (record) => ({
  id: record.id,
  name: record.name,
  needsDocumentationRules: Boolean(record.needs_documentation_rules),
  documentationTargetField: record.documentation_target_field || null,
  fields: parseJson(record.fields_json, {})
});

const toRouteModelPayload = (route) => ({
  path: route.path,
  method: normalizeMethod(route.method),
  enabled: route.enabled !== false,
  module_options_json: serializeJson(sanitizeRouteModuleOptions(route.moduleOptions || {}), {}),
  headers_json: serializeJson(route.headers || [], []),
  targets_json: serializeJson(route.targets || [], [])
});

const toTemplateModelPayload = (template) => ({
  name: template.name,
  needs_documentation_rules: template.needsDocumentationRules === true,
  documentation_target_field: template.documentationTargetField || null,
  fields_json: serializeJson(template.fields || {}, {})
});

const validateTemplatePayload = (template) => {
  if (!template || typeof template !== 'object') return 'Template payload must be an object';
  if (!template.name || typeof template.name !== 'string') return 'Template name is required';
  if (!template.fields || typeof template.fields !== 'object' || Array.isArray(template.fields)) {
    return 'Template fields must be an object';
  }

  if (template.needsDocumentationRules === true) {
    if (!template.documentationTargetField || typeof template.documentationTargetField !== 'string') {
      return 'documentationTargetField is required when needsDocumentationRules is true';
    }

    if (!Object.prototype.hasOwnProperty.call(template.fields, template.documentationTargetField)) {
      return `documentationTargetField '${template.documentationTargetField}' must exist in template fields`;
    }
  }

  return null;
};

const validateRoutePayload = (route) => {
  if (!route || typeof route !== 'object') return 'Route payload must be an object';
  if (!route.path || typeof route.path !== 'string') return 'Route path is required';
  if (!route.path.startsWith(webhookPathPrefix)) return `Route path must start with '${webhookPathPrefix}'`;
  if (!Array.isArray(route.targets) || route.targets.length === 0) {
    return 'At least one target URL is required';
  }

  const validation = validateRoutesConfig([route]);
  if (!validation.valid) {
    return validation.errors.join('; ');
  }

  return null;
};

let routeConfigs = [];
const routeConfigIndex = new Map();
const forwardQueue = [];
let activeForwardCount = 0;
let hasWarnedOnForwardQueue = false;

const modules = {};
async function loadModules() {
  try {
    const moduleExport = await import('./logic/templateDriver.js');
    const moduleName = moduleExport.default?.name;
    if (moduleName) {
      modules[moduleName] = moduleExport;
    } else {
      console.warn('templateDriver.js does not export a moduleName');
    }
  } catch (err) {
    console.error('Error loading templateDriver module:', err);
  }
}

const refreshTemplateRegistryFromDb = async () => {
  const templateRows = await Template.findAll({ order: [['name', 'ASC']] });
  const templateEntries = templateRows.map(toTemplatePayloadFromModel);
  replaceTemplateRegistry(templateEntries);
  return templateEntries;
};

const refreshRoutesFromDb = async () => {
  const routeRows = await RouteConfig.findAll({ order: [['id', 'ASC']] });
  routeConfigs = routeRows.map(toRoutePayloadFromModel);
  routeConfigIndex.clear();
  routeConfigs.forEach((route) => {
    if (route.enabled === false) return;
    routeConfigIndex.set(routeCacheKey(route.path, route.method), route);
  });
  return routeConfigs;
};

app.use('/api', apiCorsMiddleware);
app.use(frontendSessionAuthMiddleware);
app.use('/api', express.json({ limit: '10mb' }));
app.use('/api', frontendApiAccessMiddleware);
app.use('/api/templates', adminAuthMiddleware);
app.use('/api/configs', adminAuthMiddleware);
app.use('/api/ui/templates', adminAuthMiddleware);
if (serveUi) {
  app.use('/ui', express.static(path.join(__dirname, 'ui')));
}
app.use(webhookPathPrefix, express.raw({ type: '*/*', limit: '10mb' }));

if (serveUi) {
  app.get('/auth/login', (req, res) => {
    if (!frontendAuthEnabled) {
      res.redirect('/ui/config-builder');
      return;
    }

    res.sendFile(path.join(__dirname, 'ui', 'login.html'));
  });

  app.post('/auth/login', express.urlencoded({ extended: false }), (req, res) => {
    if (!frontendAuthEnabled) {
      res.redirect('/ui/config-builder');
      return;
    }

    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const redirectTarget = typeof req.body?.next === 'string' && req.body.next.startsWith('/')
      ? req.body.next
      : '/ui/config-builder';

    if (!timingSafeEquals(username, frontendAuthUsername) || !timingSafeEquals(password, frontendAuthPassword)) {
      const loginErrorTarget = encodeURIComponent(redirectTarget);
      res.redirect(`/auth/login?error=1&next=${loginErrorTarget}`);
      return;
    }

    const token = createFrontendSessionToken();
    setFrontendSessionCookie(req, res, token);
    res.redirect(redirectTarget);
  });

  app.post('/auth/logout', (req, res) => {
    clearFrontendSessionCookie(req, res);
    res.redirect('/auth/login?loggedOut=1');
  });

  app.get('/auth/logout', (req, res) => {
    clearFrontendSessionCookie(req, res);
    res.redirect('/auth/login?loggedOut=1');
  });
}

app.get('/api/ui/templates', async (req, res) => {
  try {
    await refreshTemplateRegistryFromDb();
    res.json({ templates: getTemplateCatalog() });
  } catch (err) {
    console.error('Failed to load UI templates:', err);
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

app.get('/api/templates', async (req, res) => {
  try {
    const rows = await Template.findAll({ order: [['name', 'ASC']] });
    res.json({ templates: rows.map(toTemplatePayloadFromModel) });
  } catch (err) {
    console.error('Failed to list templates:', err);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const payload = req.body;
    const validationError = validateTemplatePayload(payload);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const row = await Template.create(toTemplateModelPayload(payload));
    await refreshTemplateRegistryFromDb();
    res.status(201).json({ template: toTemplatePayloadFromModel(row) });
  } catch (err) {
    console.error('Failed to create template:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.put('/api/templates/:id', async (req, res) => {
  try {
    const payload = req.body;
    const validationError = validateTemplatePayload(payload);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const row = await Template.findByPk(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    await row.update(toTemplateModelPayload(payload));
    await refreshTemplateRegistryFromDb();
    res.json({ template: toTemplatePayloadFromModel(row) });
  } catch (err) {
    console.error('Failed to update template:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const row = await Template.findByPk(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    const templateCount = await Template.count();
    if (templateCount <= 1) {
      res.status(400).json({ error: 'Cannot delete the last template record' });
      return;
    }

    await row.destroy();
    await refreshTemplateRegistryFromDb();
    res.status(204).end();
  } catch (err) {
    console.error('Failed to delete template:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

app.get('/api/configs', async (req, res) => {
  try {
    const rows = await RouteConfig.findAll({ order: [['id', 'ASC']] });
    res.json({ configs: rows.map(toRoutePayloadFromModel) });
  } catch (err) {
    console.error('Failed to list configs:', err);
    res.status(500).json({ error: 'Failed to list configs' });
  }
});

app.post('/api/configs', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      method: normalizeMethod(req.body?.method)
    };

    const validationError = validateRoutePayload(payload);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const row = await RouteConfig.create(toRouteModelPayload(payload));
    await refreshRoutesFromDb();
    res.status(201).json({ config: toRoutePayloadFromModel(row) });
  } catch (err) {
    console.error('Failed to create config:', err);
    res.status(500).json({ error: 'Failed to create config' });
  }
});

app.put('/api/configs/:id', async (req, res) => {
  try {
    const payload = {
      ...req.body,
      method: normalizeMethod(req.body?.method)
    };

    const validationError = validateRoutePayload(payload);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const row = await RouteConfig.findByPk(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    await row.update(toRouteModelPayload(payload));
    await refreshRoutesFromDb();
    res.json({ config: toRoutePayloadFromModel(row) });
  } catch (err) {
    console.error('Failed to update config:', err);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

app.delete('/api/configs/:id', async (req, res) => {
  try {
    const row = await RouteConfig.findByPk(req.params.id);
    if (!row) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }

    await row.destroy();
    await refreshRoutesFromDb();
    res.status(204).end();
  } catch (err) {
    console.error('Failed to delete config:', err);
    res.status(500).json({ error: 'Failed to delete config' });
  }
});

if (serveUi) {
  app.get('/ui/config-builder', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'config-builder.html'));
  });

  app.get('/ui/template-builder', (req, res) => {
    res.sendFile(path.join(__dirname, 'ui', 'template-builder.html'));
  });

  app.get('/', (req, res) => {
    res.redirect('/ui/config-builder');
  });

  app.get('/ui', (req, res) => {
    res.redirect('/ui/config-builder');
  });
} else {
  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Gateherald API server' });
  });
}

function forwardRequest(targetUrl, method, headers, body, requestId) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.path,
      method: method,
      headers: headers
    };

    const req = client.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', async () => {
        try {
          await Egress.create({
            request_id: requestId,
            target_url: targetUrl,
            status: 'success',
            response_status: res.statusCode
          });
          resolve({ status: 'success', responseStatus: res.statusCode });
        } catch (err) {
          console.error('Error inserting forwarding record:', err);
          resolve({ status: 'success', responseStatus: res.statusCode });
        }
      });
    });

    req.setTimeout(forwardRequestTimeoutMs, () => {
      req.destroy(new Error(`Forwarding request timed out after ${forwardRequestTimeoutMs}ms`));
    });

    req.on('error', async (err) => {
      try {
        await Egress.create({
          request_id: requestId,
          target_url: targetUrl,
          status: 'error',
          error_message: err.message
        });
        resolve({ status: 'error', error: err.message });
      } catch (dbErr) {
        console.error('Error inserting forwarding record:', dbErr);
        resolve({ status: 'error', error: err.message });
      }
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

const pumpForwardQueue = () => {
  while (activeForwardCount < forwardMaxConcurrent && forwardQueue.length > 0) {
    const task = forwardQueue.shift();
    activeForwardCount += 1;

    Promise.resolve()
      .then(task)
      .catch((err) => {
        console.error('Unexpected forwarding queue error:', err);
      })
      .finally(() => {
        activeForwardCount -= 1;
        if (forwardQueue.length < forwardQueueWarnThreshold) {
          hasWarnedOnForwardQueue = false;
        }
        pumpForwardQueue();
      });
  }
};

const enqueueForwardRequest = (task) => {
  forwardQueue.push(task);

  if (!hasWarnedOnForwardQueue && forwardQueue.length >= forwardQueueWarnThreshold) {
    console.warn(
      `Forward queue depth is ${forwardQueue.length}; consider increasing FORWARD_MAX_CONCURRENT or checking downstream latency.`
    );
    hasWarnedOnForwardQueue = true;
  }

  pumpForwardQueue();
};

const resolveHeaderValue = (value) => {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('process.env.')) return value;

  const envKey = value.slice('process.env.'.length);
  return process.env[envKey] || '';
};

app.all(`${webhookPathPrefix}:routeId`, async (req, res) => {
  const route = routeConfigIndex.get(routeCacheKey(req.path, req.method));

  if (!route) {
    res.status(404).send('Route not configured');
    return;
  }

  try {
    const headers = JSON.stringify(req.headers);
    const queryParams = JSON.stringify(req.query);
    const body = req.body ? req.body.toString() : null;

    const webhookRecord = await Ingress.create({
      method: req.method,
      url: req.originalUrl,
      headers,
      query_params: queryParams,
      body
    });

    const requestId = webhookRecord.id;
    let bodyToForward = req.body;

    if (modules.TemplateDriver) {
      const transformed = modules.TemplateDriver.handle({
        body: req.body,
        headers: req.headers,
        route: {
          path: route.path,
          method: route.method,
          module: 'TemplateDriver'
        },
        options: route.moduleOptions || {}
      });
      if (transformed) {
        bodyToForward = Buffer.from(JSON.stringify(transformed));
        console.log('Transformed payload:', JSON.stringify(transformed, null, 2));
      }
    }

    res.status(200).send('Picked up by Herald at the Gate');

    route.targets.forEach((target) => {
      const customHeaders = {};
      if (Array.isArray(route.headers)) {
        route.headers.forEach((header) => {
          if (!header?.name) return;
          customHeaders[header.name] = resolveHeaderValue(header.value);
        });
      }

      const forwardHeaders = {
        ...req.headers,
        ...customHeaders,
        'Content-Type': 'application/json'
      };
      enqueueForwardRequest(() => forwardRequest(target.url, req.method, forwardHeaders, bodyToForward, requestId));
    });
  } catch (err) {
    console.error('Error processing webhook:', err);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
app.get('/api', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Request received'
  });
});

if (serveUi) {
  app.get(/.*/, (req, res, next) => {
    if (
      req.path.startsWith('/api')
      || req.path.startsWith(webhookPathPrefix)
    ) {
      next();
      return;
    }

    res.redirect('/ui/config-builder');
  });
}

async function startServer() {
  if (frontendAuthEnabled && (!frontendAuthUsername || !frontendAuthPassword || !frontendAuthSessionSecret)) {
    throw new Error(
      'FRONTEND_AUTH_ENABLED=true requires FRONTEND_AUTH_USERNAME, FRONTEND_AUTH_PASSWORD, and FRONTEND_AUTH_SESSION_SECRET.'
    );
  }

  if (frontendOnlyApi && !adminProxySharedSecret) {
    throw new Error(
      'FRONTEND_ONLY_API=true requires ADMIN_PROXY_SHARED_SECRET so trusted frontend proxy requests can be verified.'
    );
  }

  if (!frontendOnlyApi && !adminApiToken && !adminProxySharedSecret) {
    console.warn(
      'Security warning: FRONTEND_ONLY_API=false and no admin secrets are configured. /api routes may be reachable without authentication depending on network/proxy exposure.'
    );
  }

  await runMigrations(sequelize);

  await refreshTemplateRegistryFromDb();
  await refreshRoutesFromDb();

  const validation = validateRoutesConfig(routeConfigs);
  if (!validation.valid) {
    console.error('Invalid route/module configuration detected:');
    validation.errors.forEach((error) => console.error(`- ${error}`));
    throw new Error('Configuration validation failed. Fix database config records before starting the server.');
  }

  await loadModules();
  app.listen(PORT, () => {
    console.log(`Webhook proxy server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
