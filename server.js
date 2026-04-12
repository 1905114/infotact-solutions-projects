const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Add this root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Food Delivery Platform API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      test: 'GET /api/test',
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.post('/api/auth/register', (req, res) => {
  res.json({ success: true, message: 'Registration demo', data: req.body });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login demo', token: 'demo_token' });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));