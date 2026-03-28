const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

export const getByPath = (source, path) => {
  if (!path) return undefined;
  if (source == null) return undefined;

  const segments = path.split('.').filter(Boolean);
  let cursor = source;

  for (const segment of segments) {
    if (cursor == null || !hasOwn(cursor, segment)) {
      return undefined;
    }
    cursor = cursor[segment];
  }

  return cursor;
};

const resolveMappingSpec = (payload, mappingSpec) => {
  if (!mappingSpec) return undefined;

  if (typeof mappingSpec === 'string') {
    return getByPath(payload, mappingSpec);
  }

  if (!Array.isArray(mappingSpec)) {
    return undefined;
  }

  const parts = [];
  let hasResolvedValue = false;

  for (const segment of mappingSpec) {
    if (!segment || typeof segment !== 'object') continue;

    if (segment.type === 'text') {
      parts.push(segment.value || '');
      continue;
    }

    if (segment.type === 'path') {
      const value = getByPath(payload, segment.value);
      if (value === undefined || value === null) continue;
      parts.push(value.toString());
      hasResolvedValue = true;
    }
  }

  if (!parts.length) {
    return undefined;
  }

  if (!hasResolvedValue && parts.every(part => part === '')) {
    return undefined;
  }

  return parts.join('');
};

export const mapFields = (payload, fieldMap = {}) => {
  const mapped = {};

  for (const [targetField, mappingSpec] of Object.entries(fieldMap)) {
    if (!mappingSpec) continue;
    const value = resolveMappingSpec(payload, mappingSpec);
    if (value !== undefined) {
      mapped[targetField] = value;
    }
  }

  return mapped;
};

export const filterFieldMapByAllowedTargets = (fieldMap = {}, allowedTargets = new Set()) => {
  const filtered = {};

  for (const [targetField, sourcePath] of Object.entries(fieldMap)) {
    if (!allowedTargets.has(targetField)) continue;
    filtered[targetField] = sourcePath;
  }

  return filtered;
};

export const buildFromTemplate = ({ template = {}, mapped = {}, overrides = {} } = {}) => {
  return {
    ...template,
    ...mapped,
    ...overrides
  };
};
