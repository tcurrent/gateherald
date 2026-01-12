const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');
const https = require('https');
const url = require('url');
const config = require('./config');

const app = express();
const db = new sqlite3.Database('webhook-proxy.db');

// Middleware to parse raw body
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS webhook_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      headers TEXT,
      query_params TEXT,
      body TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forwarding_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER,
      target_url TEXT NOT NULL,
      status TEXT NOT NULL,
      response_status INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT,
      FOREIGN KEY (request_id) REFERENCES webhook_requests (id)
    )
  `);
});

// Function to forward request
function forwardRequest(targetUrl, method, headers, body, requestId) {
  return new Promise((resolve) => {
    const parsedUrl = url.parse(targetUrl);
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
      res.on('end', () => {
        db.run(
          'INSERT INTO forwarding_records (request_id, target_url, status, response_status) VALUES (?, ?, ?, ?)',
          [requestId, targetUrl, 'success', res.statusCode],
          (err) => {
            if (err) console.error('Error inserting forwarding record:', err);
            resolve({ status: 'success', responseStatus: res.statusCode });
          }
        );
      });
    });

    req.on('error', (err) => {
      db.run(
        'INSERT INTO forwarding_records (request_id, target_url, status, error_message) VALUES (?, ?, ?, ?)',
        [requestId, targetUrl, 'error', err.message],
        (err2) => {
          if (err2) console.error('Error inserting forwarding record:', err2);
          resolve({ status: 'error', error: err.message });
        }
      );
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// Set up routes from config
config.forEach(route => {
  app[route.method.toLowerCase()](route.path, async (req, res) => {
    // Save incoming request to database
    const headers = JSON.stringify(req.headers);
    const queryParams = JSON.stringify(req.query);
    const body = req.body ? req.body.toString() : null;

    db.run(
      'INSERT INTO webhook_requests (method, url, headers, query_params, body) VALUES (?, ?, ?, ?, ?)',
      [req.method, req.originalUrl, headers, queryParams, body],
      function(err) {
        if (err) {
          console.error('Error saving webhook request:', err);
          return res.status(500).send('Internal Server Error');
        }

        const requestId = this.lastID;

        // Respond immediately
        res.status(200).send('Webhook received and forwarded');

        // Forward to all targets asynchronously
        route.targets.forEach(target => {
          forwardRequest(target.url, req.method, req.headers, req.body, requestId);
        });
      }
    );
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook proxy server running on port ${PORT}`);
});
