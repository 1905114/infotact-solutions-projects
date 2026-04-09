const express = require('express');
const http = require('http');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');

// Load environment variables
dotenv.config();

// Import database connection
const connectDB = require('./config/database');

// Import middleware
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');

// Import WebSocket Controller
const WebSocketController = require('./websocket/websocketController');

// Initialize express app
const app = express();

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Controller
const wsController = new WebSocketController(server);
wsController.initialize(WebSocket);

// Make WebSocket controller available to routes
app.set('wsController', wsController);

// Connect to MongoDB Atlas
connectDB();

// ==================== MIDDLEWARE ====================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://yourdomain.com']
    : '*',
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// ==================== ROUTES ====================

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    websocket: wsController ? 'active' : 'inactive',
    connections: wsController ? wsController.getActiveConnections() : 0,
  });
});

// WebSocket stats endpoint
app.get('/websocket/stats', (req, res) => {
  if (wsController) {
    res.status(200).json({
      success: true,
      data: wsController.getStats(),
    });
  } else {
    res.status(500).json({
      success: false,
      message: 'WebSocket controller not initialized',
    });
  }
});

// API root endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Food Delivery Platform API',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      restaurants: '/api/restaurants',
      cart: '/api/cart',
      orders: '/api/orders',
    },
    websocket: {
      url: `ws://localhost:${process.env.PORT || 5000}`,
      status: 'active',
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// 404 handler for undefined routes
app.use(notFound);

// Global error handler
app.use(errorHandler);

// ==================== SERVER START ====================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 Server started successfully`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 HTTP Port: ${PORT}`);
  console.log(`🔗 HTTP URL: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket URL: ws://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api`);
  console.log(`📊 WebSocket Stats: http://localhost:${PORT}/websocket/stats`);
  console.log('='.repeat(60));
});

// ==================== ERROR HANDLING ====================

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error(`❌ Error: ${err.message}`);
  console.error(err.stack);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error(err.stack);
  server.close(() => process.exit(1));
});

// Handle SIGTERM (for graceful shutdown in production)
process.on('SIGTERM', () => {
  console.info('⚠️ SIGTERM signal received: closing HTTP server');
  if (wsController) {
    console.info('Closing WebSocket connections...');
    wsController.closeAllConnections();
  }
  server.close(() => {
    console.info('✅ HTTP server closed');
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.info('⚠️ SIGINT signal received: closing HTTP server');
  if (wsController) {
    console.info('Closing WebSocket connections...');
    wsController.closeAllConnections();
  }
  server.close(() => {
    console.info('✅ HTTP server closed');
    process.exit(0);
  });
});

// Export for testing
module.exports = { app, server, wsController };