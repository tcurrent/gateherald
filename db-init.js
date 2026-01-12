const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('webhook-proxy.db');

db.serialize(() => {
  // Create table for incoming webhook requests
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

  // Create table for forwarding records
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

  console.log('Database initialized successfully');
});

db.close();
