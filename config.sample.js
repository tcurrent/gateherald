module.exports = [
  {
    path: '/webhook1',
    method: 'POST',
    targets: [
      { url: 'http://myapp.example.com/webhook1' },
      { url: 'http://myapp2.example2.com/webhook1' },
      { url: 'http://example3.com/mywebook' }
    ]
  }
];
