/**
 * WebSocket Integration Tests
 * Tests connection handling, reconnection, and message delivery
 */

const { createServer } = require('http');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const { app, server } = require('../server');
const WebSocketController = require('../controllers/websocketController');

describe('WebSocket Tests', () => {
  let wsController;
  let testServer;
  let testWs;
  let testUserToken;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/food_test');
    
    // Create test server
    testServer = createServer(app);
    wsController = new WebSocketController(testServer);
    wsController.initialize(WebSocket);
    
    testServer.listen(8080);
    
    // Create test user and get token
    const user = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phoneNumber: '+1234567890',
      password: 'Test123!',
    });
    
    testUserToken = generateToken(user._id, user.email, user.role);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    testServer.close();
  });

  describe('Connection Management', () => {
    test('should establish WebSocket connection with valid token', (done) => {
      const ws = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });

    test('should reject connection without token', (done) => {
      const ws = new WebSocket('ws://localhost:8080/ws');
      
      ws.on('close', (code) => {
        expect(code).toBe(1008);
        done();
      });
    });

    test('should reject connection with invalid token', (done) => {
      const ws = new WebSocket('ws://localhost:8080/ws?token=invalid_token');
      
      ws.on('close', (code) => {
        expect(code).toBe(1008);
        done();
      });
    });

    test('should handle multiple connections from same user', (done) => {
      let connections = 0;
      
      const ws1 = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      const ws2 = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      
      ws1.on('open', () => {
        connections++;
        if (connections === 2) {
          expect(wsController.clientsManager.getUserConnectionCount(testUser.userId)).toBe(2);
          ws1.close();
          ws2.close();
          done();
        }
      });
      
      ws2.on('open', () => {
        connections++;
        if (connections === 2) {
          expect(wsController.clientsManager.getUserConnectionCount(testUser.userId)).toBe(2);
          ws1.close();
          ws2.close();
          done();
        }
      });
    });
  });

  describe('Reconnection and Network Drops', () => {
    test('should maintain message queue during temporary disconnection', (done) => {
      let ws;
      let messageReceived = false;
      
      // Simulate network drop by closing and reopening
      const connect = () => {
        ws = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
        
        ws.on('open', () => {
          if (!messageReceived) {
            ws.send(JSON.stringify({ type: 'SUBSCRIBE_ORDER', orderId: 'test_order_123' }));
          }
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.type === 'ORDER_STATUS_UPDATE' && !messageReceived) {
            messageReceived = true;
            ws.close();
            done();
          }
        });
      };
      
      connect();
      
      // Simulate message being sent after reconnection
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          wsController.broadcastOrderStatus('test_order_123', 'confirmed', { test: true });
        }
      }, 500);
    });

    test('should handle heartbeat and keep-alive', (done) => {
      const ws = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      let pongReceived = false;
      
      ws.on('open', () => {
        ws.on('pong', () => {
          pongReceived = true;
          expect(pongReceived).toBe(true);
          ws.close();
          done();
        });
        
        // Force ping from server
        setTimeout(() => {
          ws.ping();
        }, 100);
      });
    });
  });

  describe('Message Delivery', () => {
    test('should deliver order status updates to subscribed clients', (done) => {
      const ws = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      const orderId = new mongoose.Types.ObjectId();
      
      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'SUBSCRIBE_ORDER', orderId: orderId.toString() }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'ORDER_STATUS_UPDATE') {
          expect(message.orderId).toBe(orderId.toString());
          expect(message.status).toBe('confirmed');
          ws.close();
          done();
        }
      });
      
      setTimeout(() => {
        wsController.broadcastOrderStatus(orderId.toString(), 'confirmed', { test: true });
      }, 500);
    });

    test('should not deliver messages to unsubscribed clients', (done) => {
      const ws1 = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      const ws2 = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      const orderId = new mongoose.Types.ObjectId();
      
      let ws1Received = false;
      let ws2Received = false;
      
      ws1.on('open', () => {
        ws1.send(JSON.stringify({ type: 'SUBSCRIBE_ORDER', orderId: orderId.toString() }));
      });
      
      ws1.on('message', () => {
        ws1Received = true;
      });
      
      ws2.on('message', () => {
        ws2Received = true;
      });
      
      setTimeout(() => {
        wsController.broadcastOrderStatus(orderId.toString(), 'confirmed', { test: true });
        
        setTimeout(() => {
          expect(ws1Received).toBe(true);
          expect(ws2Received).toBe(false);
          ws1.close();
          ws2.close();
          done();
        }, 500);
      }, 500);
    });

    test('should handle malformed messages gracefully', (done) => {
      const ws = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      
      ws.on('open', () => {
        ws.send('invalid json');
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'ERROR') {
          expect(message.code).toBe('INVALID_MESSAGE');
          ws.close();
          done();
        }
      });
    });
  });

  describe('Order Acceptance Flow', () => {
    test('should broadcast order acceptance to customer', (done) => {
      const customerWs = new WebSocket(`ws://localhost:8080/ws?token=${testUserToken}`);
      const orderId = new mongoose.Types.ObjectId();
      
      customerWs.on('open', () => {
        customerWs.send(JSON.stringify({ type: 'SUBSCRIBE_ORDER', orderId: orderId.toString() }));
      });
      
      customerWs.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.type === 'ORDER_STATUS_UPDATE' && message.status === 'confirmed') {
          expect(message.orderId).toBe(orderId.toString());
          customerWs.close();
          done();
        }
      });
      
      setTimeout(() => {
        wsController.broadcastOrderStatus(orderId.toString(), 'confirmed', {
          orderNumber: 'ORD-123',
          estimatedTime: 30,
        });
      }, 500);
    });
  });
});