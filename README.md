# Webhook Multiplexer Proxy

A lightweight Node.js proxy server that receives webhook requests and forwards them to multiple target URLs simultaneously. Built with Express.js and SQLite for reliable webhook handling and logging.

## Features

- **Multiple Target Forwarding**: Forward incoming webhooks to multiple endpoints at once
- **Asynchronous Processing**: Responds immediately to webhook senders while forwarding in background
- **Complete Request Logging**: Stores all incoming requests with headers, body, and metadata
- **Forwarding Status Tracking**: Logs success/failure status for each forwarding attempt
- **SQLite Database**: Persistent storage for all webhook data and forwarding records
- **Configurable Routes**: Easy-to-configure webhook routes with multiple targets
- **Raw Body Support**: Handles any content type including binary data up to 10MB

## Use Cases

- **Service Integration**: Forward webhooks from one service to multiple applications
- **Event Distribution**: Distribute events across multiple microservices
- **Webhook Backup**: Send webhooks to primary and backup endpoints
- **Debugging & Monitoring**: Log all webhook activity for debugging and analytics
- **Load Balancing**: Distribute webhook load across multiple servers

## Installation

1. Clone the repository:
```bash
git clone https://github.com/harish2704/webhook-multiplexer-proxy.git
cd webhook-multiplexer-proxy
```

2. Install dependencies:
```bash
npm install
```

3. Initialize the database:
```bash
npm run init-db
```

## Configuration

1. Copy the sample configuration:
```bash
cp config.sample.js config.js
```

2. Edit `config.js` to define your webhook routes and targets:

```javascript
module.exports = [
  {
    path: '/webhook/github',
    method: 'POST',
    targets: [
      { url: 'https://api.service1.com/webhooks/github' },
      { url: 'https://api.service2.com/hooks/github' },
      { url: 'https://backup.example.com/github-events' }
    ]
  },
  {
    path: '/webhook/stripe',
    method: 'POST',
    targets: [
      { url: 'https://billing.myapp.com/webhooks/stripe' },
      { url: 'https://analytics.myapp.com/events/stripe' }
    ]
  }
];
```

### Configuration Options

- **`path`**: The endpoint path for incoming webhooks (e.g., `/webhook/github`)
- **`method`**: HTTP method to accept (GET, POST, PUT, DELETE, etc.)
- **`targets`**: Array of target URLs to forward webhooks to

## Usage

1. Start the server:
```bash
npm start
```

The server will start on port 3000 by default, or use `PORT` environment variable to specify a different port.

2. Send webhooks to your configured endpoints:
```bash
curl -X POST http://localhost:3000/webhook/github \
  -H "Content-Type: application/json" \
  -d '{"event": "push", "repository": "my-repo"}'
```

The proxy will:
- Log the incoming request to the database
- Respond with "Webhook received and forwarded" immediately
- Forward the request to all configured targets asynchronously

## Database Schema

The application uses SQLite with two main tables:

### webhook_requests
Stores all incoming webhook requests:
- `id`: Primary key
- `timestamp`: When the request was received
- `method`: HTTP method (GET, POST, etc.)
- `url`: Request URL
- `headers`: JSON string of request headers
- `query_params`: JSON string of query parameters
- `body`: Raw request body

### forwarding_records
Tracks forwarding attempts:
- `id`: Primary key
- `request_id`: Foreign key to webhook_requests
- `target_url`: The target URL the request was forwarded to
- `status`: 'success' or 'error'
- `response_status`: HTTP status code from target (for successful forwards)
- `timestamp`: When the forwarding attempt occurred
- `error_message`: Error details (for failed forwards)

## API Endpoints

### Webhook Endpoints
- **Path**: Configurable (defined in `config.js`)
- **Method**: Configurable (defined in `config.js`)
- **Response**: `200 OK` with message "Webhook received and forwarded"
- **Body Limit**: 10MB

All configured webhook endpoints accept any content type and forward the exact request (including headers and body) to all target URLs.

## Development

### Scripts
- `npm start`: Start the production server
- `npm run init-db`: Initialize/create the SQLite database
- `npm test`: Run tests (currently no tests configured)

### Project Structure
```
webhook-proxy/
├── index.js          # Main application file
├── config.js         # Webhook route configuration
├── config.sample.js  # Sample configuration
├── db-init.js        # Database initialization script
├── package.json      # Dependencies and scripts
├── README.md         # This file
└── webhook-proxy.db  # SQLite database (created automatically)
```

## Security Considerations

- The proxy forwards all requests as-is, including authentication headers
- Consider implementing authentication/authorization for production use
- Validate target URLs to prevent SSRF attacks
- Monitor database size as all requests are logged
- Use HTTPS in production environments

## Monitoring & Debugging

All webhook activity is logged to the SQLite database. You can query the database to:

- View all received webhooks
- Check forwarding success/failure rates
- Debug failed forwarding attempts
- Analyze webhook patterns and frequency

Example queries:
```sql
-- View recent webhooks
SELECT * FROM webhook_requests ORDER BY timestamp DESC LIMIT 10;

-- Check forwarding status
SELECT wr.url, fr.target_url, fr.status, fr.response_status, fr.error_message
FROM webhook_requests wr
JOIN forwarding_records fr ON wr.id = fr.request_id
ORDER BY wr.timestamp DESC;
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see package.json for details

## Support

For issues and questions, please open an issue on the GitHub repository.
