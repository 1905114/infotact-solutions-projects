/**
 * WebSocket Controller
 * Manages WebSocket connections, message handling, and real-time event broadcasting
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');

class WebSocketController {
  constructor(server) {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.orderSubscriptions = new Map(); // orderId -> Set of userIds
    this.restaurantSubscriptions = new Map(); // restaurantId -> Set of userIds
    this.userStatus = new Map(); // userId -> { status, lastSeen, role, name }
    this.userTypingStatus = new Map(); // orderId -> Map of userId -> timeout
    this.server = server;
    this.pingInterval = null;
    this.cleanupInterval = null;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(WebSocket) {
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/ws',
      perMessageDeflate: true,
    });

    this.setupServerEvents();
    this.startHeartbeat();
    this.startCleanupInterval();

    console.log('✅ WebSocket Controller initialized on path: /ws');
    return this.wss;
  }

  /**
   * Setup WebSocket server event handlers
   */
  setupServerEvents() {
    this.wss.on('connection', async (ws, req) => {
      await this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });

    this.wss.on('close', () => {
      console.log('WebSocket server closed');
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    });
  }

  /**
   * Start heartbeat to keep connections alive
   */
  startHeartbeat() {
    this.pingInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.handleDisconnection(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  /**
   * Start cleanup interval for inactive connections
   */
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      let cleanedCount = 0;
      const now = Date.now();
      const inactivityTimeout = 30 * 60 * 1000; // 30 minutes

      for (const [userId, connections] of this.clients) {
        for (const [connId, connection] of connections) {
          if (now - connection.lastActivity > inactivityTimeout) {
            if (connection.ws.readyState === 1) {
              connection.ws.close(1000, 'Connection timeout due to inactivity');
            }
            connections.delete(connId);
            cleanedCount++;
          }
        }
        if (connections.size === 0) {
          this.clients.delete(userId);
          if (this.userStatus.has(userId)) {
            this.userStatus.get(userId).status = 'offline';
            this.userStatus.get(userId).lastSeen = new Date();
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} inactive connections`);
        this.broadcastUserStatus();
      }
    }, 5 * 60 * 1000); // Run every 5 minutes
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    try {
      // Extract and verify token
      const token = this.extractToken(req);
      if (!token) {
        ws.close(1008, 'No authentication token provided');
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        ws.close(1008, 'User not found');
        return;
      }

      if (!user.isActive) {
        ws.close(1008, 'Account is deactivated');
        return;
      }

      // Generate connection ID
      const connectionId = this.generateConnectionId();

      // Store connection
      ws.userId = user.id;
      ws.userRole = user.role;
      ws.userEmail = user.email;
      ws.userName = `${user.firstName} ${user.lastName}`;
      ws.connectionId = connectionId;
      ws.connectedAt = Date.now();
      ws.lastActivity = Date.now();
      ws.isAlive = true;

      if (!this.clients.has(user.id)) {
        this.clients.set(user.id, new Map());
      }
      this.clients.get(user.id).set(connectionId, {
        ws,
        connectedAt: ws.connectedAt,
        lastActivity: ws.lastActivity,
      });

      // Update user status
      this.userStatus.set(user.id, {
        status: 'online',
        lastSeen: new Date(),
        role: user.role,
        name: ws.userName,
        email: user.email,
      });

      console.log(`🔌 WebSocket connected: ${user.email} (${user.role}) - ${connectionId} [${this.getActiveConnections()} active]`);

      // Send connection confirmation
      this.sendToClient(ws, {
        type: 'CONNECTION_ESTABLISHED',
        timestamp: new Date().toISOString(),
        userId: user.id,
        userRole: user.role,
        userName: ws.userName,
        connectionId,
        message: 'Successfully connected to WebSocket server',
        stats: this.getConnectionStats(),
      });

      // Send current online status
      this.broadcastUserStatus();

      // Setup message handlers
      this.setupMessageHandlers(ws);

      // Setup heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
        if (ws.userId && ws.connectionId) {
          this.updateActivity(ws.userId, ws.connectionId);
        }
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      ws.close(1008, 'Invalid authentication token');
    }
  }

  /**
   * Extract JWT token from request
   */
  extractToken(req) {
    // Check URL query parameters
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    let token = urlParams.get('token');

    // Check headers
    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    return token;
  }

  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `conn_${timestamp}_${random}`;
  }

  /**
   * Update connection activity timestamp
   */
  updateActivity(userId, connectionId) {
    if (this.clients.has(userId)) {
      const connections = this.clients.get(userId);
      if (connections.has(connectionId)) {
        connections.get(connectionId).lastActivity = Date.now();
      }
    }
  }

  /**
   * Setup message handlers for a WebSocket connection
   */
  setupMessageHandlers(ws) {
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(ws, message);
        this.updateActivity(ws.userId, ws.connectionId);
      } catch (error) {
        console.error('Message parsing error:', error);
        this.sendToClient(ws, {
          type: 'ERROR',
          code: 'INVALID_MESSAGE',
          message: 'Invalid message format',
        });
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${ws.userId}:`, error);
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  async handleMessage(ws, message) {
    const { type, ...data } = message;

    switch (type) {
      case 'SUBSCRIBE_ORDER':
        await this.subscribeToOrder(ws, data.orderId);
        break;

      case 'UNSUBSCRIBE_ORDER':
        await this.unsubscribeFromOrder(ws, data.orderId);
        break;

      case 'SUBSCRIBE_RESTAURANT':
        await this.subscribeToRestaurant(ws, data.restaurantId);
        break;

      case 'UNSUBSCRIBE_RESTAURANT':
        await this.unsubscribeFromRestaurant(ws, data.restaurantId);
        break;

      case 'GET_ONLINE_STATUS':
        this.sendOnlineStatus(ws);
        break;

      case 'PING':
        this.sendToClient(ws, {
          type: 'PONG',
          timestamp: new Date().toISOString(),
        });
        break;

      case 'TYPING_START':
        this.handleTypingStart(ws, data);
        break;

      case 'TYPING_END':
        this.handleTypingEnd(ws, data);
        break;

      case 'GET_CONNECTION_STATS':
        this.sendToClient(ws, {
          type: 'CONNECTION_STATS',
          data: this.getConnectionStats(),
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        this.sendToClient(ws, {
          type: 'ERROR',
          code: 'UNKNOWN_TYPE',
          message: `Unknown message type: ${type}`,
        });
    }
  }

  /**
   * Subscribe to order updates
   */
  async subscribeToOrder(ws, orderId) {
    try {
      // Verify user has access to this order
      const order = await Order.findById(orderId);
      if (!order) {
        this.sendToClient(ws, {
          type: 'ERROR',
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found',
        });
        return;
      }

      // Get restaurant for owner check
      const restaurant = await Restaurant.findById(order.restaurantId);

      // Check authorization
      const hasAccess =
        order.userId.toString() === ws.userId ||
        (restaurant && restaurant.ownerId && restaurant.ownerId.toString() === ws.userId) ||
        (order.deliveryPartnerId && order.deliveryPartnerId.toString() === ws.userId) ||
        ws.userRole === 'admin';

      if (!hasAccess) {
        this.sendToClient(ws, {
          type: 'ERROR',
          code: 'UNAUTHORIZED',
          message: 'Not authorized to track this order',
        });
        return;
      }

      // Add subscription
      if (!this.orderSubscriptions.has(orderId)) {
        this.orderSubscriptions.set(orderId, new Set());
      }
      this.orderSubscriptions.get(orderId).add(ws.userId);

      this.sendToClient(ws, {
        type: 'SUBSCRIBED',
        orderId,
        message: 'Successfully subscribed to order updates',
      });

      // Send current order status immediately
      this.sendToClient(ws, {
        type: 'ORDER_STATUS_UPDATE',
        orderId,
        status: order.status,
        orderNumber: order.orderNumber,
        timestamp: new Date().toISOString(),
        orderDetails: {
          totalAmount: order.totalAmount,
          items: order.items.length,
          restaurantName: restaurant?.name,
        },
      });

      console.log(`📡 User ${ws.userEmail} subscribed to order ${orderId}`);

    } catch (error) {
      console.error('Subscribe to order error:', error);
      this.sendToClient(ws, {
        type: 'ERROR',
        code: 'SUBSCRIBE_FAILED',
        message: 'Failed to subscribe to order',
      });
    }
  }

  /**
   * Unsubscribe from order updates
   */
  async unsubscribeFromOrder(ws, orderId) {
    if (this.orderSubscriptions.has(orderId)) {
      this.orderSubscriptions.get(orderId).delete(ws.userId);
      if (this.orderSubscriptions.get(orderId).size === 0) {
        this.orderSubscriptions.delete(orderId);
      }
    }

    this.sendToClient(ws, {
      type: 'UNSUBSCRIBED',
      orderId,
      message: 'Unsubscribed from order updates',
    });
  }

  /**
   * Subscribe to restaurant updates
   */
  async subscribeToRestaurant(ws, restaurantId) {
    try {
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        this.sendToClient(ws, {
          type: 'ERROR',
          code: 'RESTAURANT_NOT_FOUND',
          message: 'Restaurant not found',
        });
        return;
      }

      if (!this.restaurantSubscriptions.has(restaurantId)) {
        this.restaurantSubscriptions.set(restaurantId, new Set());
      }
      this.restaurantSubscriptions.get(restaurantId).add(ws.userId);

      this.sendToClient(ws, {
        type: 'SUBSCRIBED',
        restaurantId,
        message: 'Successfully subscribed to restaurant updates',
      });

      console.log(`📡 User ${ws.userEmail} subscribed to restaurant ${restaurantId}`);

    } catch (error) {
      console.error('Subscribe to restaurant error:', error);
      this.sendToClient(ws, {
        type: 'ERROR',
        code: 'SUBSCRIBE_FAILED',
        message: 'Failed to subscribe to restaurant',
      });
    }
  }

  /**
   * Unsubscribe from restaurant updates
   */
  async unsubscribeFromRestaurant(ws, restaurantId) {
    if (this.restaurantSubscriptions.has(restaurantId)) {
      this.restaurantSubscriptions.get(restaurantId).delete(ws.userId);
      if (this.restaurantSubscriptions.get(restaurantId).size === 0) {
        this.restaurantSubscriptions.delete(restaurantId);
      }
    }

    this.sendToClient(ws, {
      type: 'UNSUBSCRIBED',
      restaurantId,
      message: 'Unsubscribed from restaurant updates',
    });
  }

  /**
   * Handle typing start indicator
   */
  handleTypingStart(ws, data) {
    const { orderId } = data;

    if (!this.userTypingStatus.has(orderId)) {
      this.userTypingStatus.set(orderId, new Map());
    }

    const typingUsers = this.userTypingStatus.get(orderId);
    
    // Clear existing timeout if any
    if (typingUsers.has(ws.userId)) {
      clearTimeout(typingUsers.get(ws.userId));
    }

    // Set new timeout to auto-clear after 3 seconds
    const timeout = setTimeout(() => {
      this.handleTypingEnd(ws, { orderId });
    }, 3000);

    typingUsers.set(ws.userId, timeout);

    // Broadcast typing indicator to order subscribers
    this.broadcastToOrderSubscribers(orderId, {
      type: 'USER_TYPING',
      orderId,
      userId: ws.userId,
      userName: ws.userName,
      isTyping: true,
      timestamp: new Date().toISOString(),
    }, [ws.userId]);
  }

  /**
   * Handle typing end indicator
   */
  handleTypingEnd(ws, data) {
    const { orderId } = data;

    if (this.userTypingStatus.has(orderId)) {
      const typingUsers = this.userTypingStatus.get(orderId);
      if (typingUsers.has(ws.userId)) {
        clearTimeout(typingUsers.get(ws.userId));
        typingUsers.delete(ws.userId);
      }

      // Broadcast typing ended to order subscribers
      this.broadcastToOrderSubscribers(orderId, {
        type: 'USER_TYPING',
        orderId,
        userId: ws.userId,
        userName: ws.userName,
        isTyping: false,
        timestamp: new Date().toISOString(),
      }, [ws.userId]);
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(ws) {
    if (ws.userId && ws.connectionId) {
      if (this.clients.has(ws.userId)) {
        this.clients.get(ws.userId).delete(ws.connectionId);
        if (this.clients.get(ws.userId).size === 0) {
          this.clients.delete(ws.userId);
          if (this.userStatus.has(ws.userId)) {
            this.userStatus.get(ws.userId).status = 'offline';
            this.userStatus.get(ws.userId).lastSeen = new Date();
          }
        }
      }
    }

    // Clean up typing status for this user
    for (const [orderId, typingUsers] of this.userTypingStatus) {
      if (typingUsers.has(ws.userId)) {
        clearTimeout(typingUsers.get(ws.userId));
        typingUsers.delete(ws.userId);
      }
    }

    console.log(`🔌 WebSocket disconnected: ${ws.userEmail || ws.userId} (${ws.connectionId}) [${this.getActiveConnections()} active]`);
    this.broadcastUserStatus();
  }

  /**
   * Send online status to a client
   */
  sendOnlineStatus(ws) {
    const onlineUsers = Array.from(this.userStatus.entries())
      .filter(([_, status]) => status.status === 'online')
      .map(([userId, status]) => ({
        userId,
        name: status.name,
        role: status.role,
        email: status.email,
      }));

    this.sendToClient(ws, {
      type: 'ONLINE_STATUS',
      onlineCount: onlineUsers.length,
      onlineUsers,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcast user status to all connected clients
   */
  broadcastUserStatus() {
    const onlineUsers = Array.from(this.userStatus.entries())
      .filter(([_, status]) => status.status === 'online')
      .map(([userId, status]) => ({
        userId,
        name: status.name,
        role: status.role,
      }));

    const message = {
      type: 'USER_STATUS_UPDATE',
      onlineCount: onlineUsers.length,
      onlineUsers,
      timestamp: new Date().toISOString(),
    };

    this.broadcastToAll(message);
  }

  /**
   * Broadcast order status update to all subscribers
   */
  broadcastOrderStatus(orderId, status, additionalData = {}) {
    if (!this.orderSubscriptions.has(orderId)) {
      return 0;
    }

    const message = {
      type: 'ORDER_STATUS_UPDATE',
      orderId,
      status,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    let sentCount = 0;
    const subscribers = this.orderSubscriptions.get(orderId);

    for (const userId of subscribers) {
      sentCount += this.sendToUser(userId, message);
    }

    return sentCount;
  }

  /**
   * Broadcast to all subscribers of an order
   */
  broadcastToOrderSubscribers(orderId, message, excludeUserIds = []) {
    if (!this.orderSubscriptions.has(orderId)) {
      return 0;
    }

    let sentCount = 0;
    const subscribers = this.orderSubscriptions.get(orderId);

    for (const userId of subscribers) {
      if (!excludeUserIds.includes(userId)) {
        sentCount += this.sendToUser(userId, message);
      }
    }

    return sentCount;
  }

  /**
   * Broadcast to all subscribers of a restaurant
   */
  broadcastToRestaurantSubscribers(restaurantId, message, excludeUserIds = []) {
    if (!this.restaurantSubscriptions.has(restaurantId)) {
      return 0;
    }

    let sentCount = 0;
    const subscribers = this.restaurantSubscriptions.get(restaurantId);

    for (const userId of subscribers) {
      if (!excludeUserIds.includes(userId)) {
        sentCount += this.sendToUser(userId, message);
      }
    }

    return sentCount;
  }

  /**
   * Send notification to a specific user
   */
  sendNotification(userId, title, message, type = 'info', data = {}) {
    return this.sendToUser(userId, {
      type: 'NOTIFICATION',
      notification: {
        id: Date.now().toString(),
        title,
        message,
        type, // 'info', 'success', 'warning', 'error'
        timestamp: new Date().toISOString(),
        read: false,
      },
      data,
    });
  }

  /**
   * Send message to a specific user
   */
  sendToUser(userId, message) {
    if (this.clients.has(userId)) {
      let sentCount = 0;
      const connections = this.clients.get(userId);
      for (const [connId, connection] of connections) {
        if (connection.ws.readyState === 1) { // WebSocket.OPEN
          this.sendToClient(connection.ws, message);
          sentCount++;
        }
      }
      return sentCount;
    }
    return 0;
  }

  /**
   * Send message to a specific WebSocket client
   */
  sendToClient(ws, message) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(message, filterRole = null) {
    let sentCount = 0;
    for (const [userId, connections] of this.clients) {
      for (const [connId, connection] of connections) {
        if (!filterRole || connection.ws.userRole === filterRole) {
          if (this.sendToClient(connection.ws, message)) {
            sentCount++;
          }
        }
      }
    }
    return sentCount;
  }

  /**
   * Broadcast to users with specific role
   */
  broadcastToRole(role, message, excludeUserId = null) {
    let sentCount = 0;
    for (const [userId, connections] of this.clients) {
      if (userId === excludeUserId) continue;
      for (const [connId, connection] of connections) {
        if (connection.ws.userRole === role) {
          if (this.sendToClient(connection.ws, message)) {
            sentCount++;
          }
        }
      }
    }
    return sentCount;
  }

  /**
   * Get active connection count
   */
  getActiveConnections() {
    let count = 0;
    for (const connections of this.clients.values()) {
      count += connections.size;
    }
    return count;
  }

  /**
   * Get unique user count
   */
  getUniqueUsers() {
    return this.clients.size;
  }

  /**
   * Get connection statistics
   */
  getConnectionStats() {
    const onlineUsers = Array.from(this.userStatus.entries())
      .filter(([_, status]) => status.status === 'online')
      .map(([userId, status]) => ({
        userId,
        name: status.name,
        role: status.role,
      }));

    return {
      totalConnections: this.getActiveConnections(),
      uniqueUsers: this.getUniqueUsers(),
      activeOrderSubscriptions: this.orderSubscriptions.size,
      activeRestaurantSubscriptions: this.restaurantSubscriptions.size,
      onlineUsersCount: onlineUsers.length,
      onlineUsers,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get user connection details
   */
  getUserConnectionDetails(userId) {
    if (!this.clients.has(userId)) {
      return null;
    }

    const connections = this.clients.get(userId);
    const userInfo = this.userStatus.get(userId);

    return {
      userId,
      userInfo,
      activeConnections: connections.size,
      connections: Array.from(connections.entries()).map(([connId, conn]) => ({
        connectionId: connId,
        connectedAt: new Date(conn.connectedAt).toISOString(),
        lastActivity: new Date(conn.lastActivity).toISOString(),
      })),
    };
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.clients.has(userId) && this.clients.get(userId).size > 0;
  }

  /**
   * Get all online users
   */
  getOnlineUsers() {
    return Array.from(this.userStatus.entries())
      .filter(([_, status]) => status.status === 'online')
      .map(([userId, status]) => userId);
  }

  /**
   * Close all connections for a user
   */
  closeUserConnections(userId, code = 1000, reason = 'Server shutdown') {
    if (this.clients.has(userId)) {
      const connections = this.clients.get(userId);
      for (const [connId, connection] of connections) {
        if (connection.ws.readyState === 1) {
          connection.ws.close(code, reason);
        }
      }
      this.clients.delete(userId);
      if (this.userStatus.has(userId)) {
        this.userStatus.get(userId).status = 'offline';
        this.userStatus.get(userId).lastSeen = new Date();
      }
      this.broadcastUserStatus();
    }
  }

  /**
   * Close all WebSocket connections
   */
  closeAllConnections(code = 1000, reason = 'Server shutdown') {
    if (this.wss) {
      this.wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.close(code, reason);
        }
      });
    }
    this.clients.clear();
    this.orderSubscriptions.clear();
    this.restaurantSubscriptions.clear();
    this.userStatus.clear();
    this.userTypingStatus.clear();
    
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    
    console.log('🔌 All WebSocket connections closed');
  }

  /**
   * Get server status
   */
  getServerStatus() {
    return {
      isRunning: this.wss !== null,
      totalConnections: this.getActiveConnections(),
      uniqueUsers: this.getUniqueUsers(),
      orderSubscriptions: this.orderSubscriptions.size,
      restaurantSubscriptions: this.restaurantSubscriptions.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = WebSocketController;