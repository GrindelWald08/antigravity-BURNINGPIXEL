const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Expose only public static folders and files
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.ico')));
app.get('/placeholder.svg', (req, res) => res.sendFile(path.join(__dirname, 'placeholder.svg')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Client-side HTML Routing fallbacks
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'auth.html'));
});

app.get('/account', (req, res) => {
  res.sendFile(path.join(__dirname, 'account.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/order/:orderId', (req, res) => {
  res.sendFile(path.join(__dirname, 'order-detail.html'));
});

app.get('/payment/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'payment-success.html'));
});

app.get('/payment/failed', (req, res) => {
  res.sendFile(path.join(__dirname, 'payment-failed.html'));
});

// Fallback for SPA-like routes or any other unrecognized pages to go to 404/index
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.listen(PORT, () => {
  console.log(`Burning Pixel Web Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
});
