/**
 * WebSocket Clients Manager
 * Handles client connection storage, retrieval, and management
 */

class WebSocketClientsManager {
  constructor() {
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.userMetadata = new Map(); // userId -> user metadata
    this.connectionMetadata = new Map(); // connectionId -> metadata
    this.connectionCounter = 0;
  }

  /**
   * Add a new client connection
   * @param {string} userId - User ID
   * @param {Object} ws - WebSocket connection object
   * @param {Object} metadata - User metadata (role, email, name, etc.)
   * @returns {string} Connection ID
   */
  addClient(userId, ws, metadata = {}) {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Map());
    }

    const connectionId = this.generateConnectionId();
    
    // Store connection
    this.clients.get(userId).set(connectionId, {
      ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        ...metadata,
        connectionId,
      },
    });

    // Store connection metadata
    this.connectionMetadata.set(connectionId, {
      userId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      ...metadata,
    });

    // Update user metadata
    if (!this.userMetadata.has(userId)) {
      this.userMetadata.set(userId, {
        userId,
        firstSeen: new Date(),
        totalConnections: 0,
        ...metadata,
      });
    }
    
    const userMeta = this.userMetadata.get(userId);
    userMeta.totalConnections++;
    userMeta.lastSeen = new Date();
    userMeta.status = 'online';

    this.connectionCounter++;
    
    console.log(`📱 Client added: ${userId} (${connectionId}) - Total connections: ${this.connectionCounter}`);
    
    return connectionId;
  }

  /**
   * Remove a client connection
   * @param {string} userId - User ID
   * @param {string} connectionId - Connection ID (optional, removes all if not provided)
   * @returns {boolean} True if removed successfully
   */
  removeClient(userId, connectionId = null) {
    if (!this.clients.has(userId)) {
      return false;
    }

    if (connectionId) {
      // Remove specific connection
      const removed = this.clients.get(userId).delete(connectionId);
      if (removed) {
        this.connectionMetadata.delete(connectionId);
        this.connectionCounter--;
      }
      
      // If no more connections for this user, remove user entry
      if (this.clients.get(userId).size === 0) {
        this.clients.delete(userId);
        if (this.userMetadata.has(userId)) {
          this.userMetadata.get(userId).status = 'offline';
          this.userMetadata.get(userId).lastSeen = new Date();
        }
      }
      
      console.log(`📱 Client removed: ${userId} (${connectionId}) - Remaining connections: ${this.connectionCounter}`);
      return removed;
    } else {
      // Remove all connections for this user
      const connections = this.clients.get(userId);
      if (connections) {
        for (const [connId] of connections) {
          this.connectionMetadata.delete(connId);
          this.connectionCounter--;
        }
      }
      this.clients.delete(userId);
      
      if (this.userMetadata.has(userId)) {
        this.userMetadata.get(userId).status = 'offline';
        this.userMetadata.get(userId).lastSeen = new Date();
      }
      
      console.log(`📱 All clients removed for user: ${userId} - Total connections: ${this.connectionCounter}`);
      return true;
    }
  }

  /**
   * Get all connections for a specific user
   * @param {string} userId - User ID
   * @returns {Array} Array of connection objects
   */
  getUserConnections(userId) {
    if (!this.clients.has(userId)) {
      return [];
    }
    
    return Array.from(this.clients.get(userId).values());
  }

  /**
   * Get all active WebSocket connections for a user
   * @param {string} userId - User ID
   * @returns {Array} Array of WebSocket objects
   */
  getUserWebSockets(userId) {
    if (!this.clients.has(userId)) {
      return [];
    }
    
    return Array.from(this.clients.get(userId).values()).map(conn => conn.ws);
  }

  /**
   * Get user metadata
   * @param {string} userId - User ID
   * @returns {Object|null} User metadata or null
   */
  getUserMetadata(userId) {
    return this.userMetadata.get(userId) || null;
  }

  /**
   * Update user metadata
   * @param {string} userId - User ID
   * @param {Object} metadata - Metadata to update
   */
  updateUserMetadata(userId, metadata) {
    if (this.userMetadata.has(userId)) {
      const current = this.userMetadata.get(userId);
      this.userMetadata.set(userId, { ...current, ...metadata });
    } else {
      this.userMetadata.set(userId, {
        userId,
        firstSeen: new Date(),
        totalConnections: 0,
        ...metadata,
      });
    }
  }

  /**
   * Get connection metadata
   * @param {string} connectionId - Connection ID
   * @returns {Object|null} Connection metadata or null
   */
  getConnectionMetadata(connectionId) {
    return this.connectionMetadata.get(connectionId) || null;
  }

  /**
   * Update connection last activity time
   * @param {string} userId - User ID
   * @param {string} connectionId - Connection ID
   */
  updateActivity(userId, connectionId) {
    if (this.clients.has(userId)) {
      const connections = this.clients.get(userId);
      if (connections.has(connectionId)) {
        const connection = connections.get(connectionId);
        connection.lastActivity = new Date();
        
        if (this.connectionMetadata.has(connectionId)) {
          this.connectionMetadata.get(connectionId).lastActivity = new Date();
        }
      }
    }
  }

  /**
   * Check if user is online
   * @param {string} userId - User ID
   * @returns {boolean} True if user has active connections
   */
  isUserOnline(userId) {
    return this.clients.has(userId) && this.clients.get(userId).size > 0;
  }

  /**
   * Get all online users
   * @returns {Array} Array of online user IDs
   */
  getOnlineUsers() {
    const onlineUsers = [];
    for (const [userId] of this.clients) {
      if (this.isUserOnline(userId)) {
        onlineUsers.push(userId);
      }
    }
    return onlineUsers;
  }

  /**
   * Get all online users with metadata
   * @returns {Array} Array of online user objects with metadata
   */
  getOnlineUsersWithMetadata() {
    const onlineUsers = [];
    for (const [userId] of this.clients) {
      if (this.isUserOnline(userId)) {
        const metadata = this.getUserMetadata(userId);
        if (metadata) {
          onlineUsers.push({
            userId,
            ...metadata,
            connectionCount: this.clients.get(userId).size,
          });
        }
      }
    }
    return onlineUsers;
  }

  /**
   * Get users by role
   * @param {string} role - User role (customer, restaurant_owner, delivery_partner, admin)
   * @returns {Array} Array of user IDs with the specified role
   */
  getUsersByRole(role) {
    const users = [];
    for (const [userId, metadata] of this.userMetadata) {
      if (metadata.role === role && this.isUserOnline(userId)) {
        users.push(userId);
      }
    }
    return users;
  }

  /**
   * Get connection count
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    let totalWebSockets = 0;
    for (const connections of this.clients.values()) {
      totalWebSockets += connections.size;
    }
    
    return {
      totalConnections: this.connectionCounter,
      activeWebSockets: totalWebSockets,
      uniqueUsers: this.clients.size,
      onlineUsers: this.getOnlineUsers().length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get detailed user connection info
   * @param {string} userId - User ID
   * @returns {Object|null} User connection details
   */
  getUserConnectionDetails(userId) {
    if (!this.clients.has(userId)) {
      return null;
    }
    
    const connections = this.clients.get(userId);
    const metadata = this.getUserMetadata(userId);
    
    return {
      userId,
      metadata,
      activeConnections: connections.size,
      connections: Array.from(connections.entries()).map(([connId, conn]) => ({
        connectionId: connId,
        connectedAt: conn.connectedAt,
        lastActivity: conn.lastActivity,
        metadata: conn.metadata,
      })),
    };
  }

  /**
   * Broadcast message to all clients of a user
   * @param {string} userId - User ID
   * @param {Object} message - Message to send
   * @returns {number} Number of clients that received the message
   */
  broadcastToUser(userId, message) {
    if (!this.clients.has(userId)) {
      return 0;
    }
    
    let sentCount = 0;
    const connections = this.clients.get(userId);
    
    for (const [connId, connection] of connections) {
      if (connection.ws.readyState === 1) { // WebSocket.OPEN
        try {
          connection.ws.send(JSON.stringify(message));
          sentCount++;
          this.updateActivity(userId, connId);
        } catch (error) {
          console.error(`Failed to send message to ${userId} (${connId}):`, error);
        }
      }
    }
    
    return sentCount;
  }

  /**
   * Broadcast message to all users with specific role
   * @param {string} role - User role
   * @param {Object} message - Message to send
   * @returns {number} Number of clients that received the message
   */
  broadcastToRole(role, message) {
    let sentCount = 0;
    const targetUsers = this.getUsersByRole(role);
    
    for (const userId of targetUsers) {
      sentCount += this.broadcastToUser(userId, message);
    }
    
    return sentCount;
  }

  /**
   * Broadcast message to all connected clients
   * @param {Object} message - Message to send
   * @param {string} excludeUserId - Optional user ID to exclude
   * @returns {number} Number of clients that received the message
   */
  broadcastToAll(message, excludeUserId = null) {
    let sentCount = 0;
    
    for (const [userId] of this.clients) {
      if (userId !== excludeUserId) {
        sentCount += this.broadcastToUser(userId, message);
      }
    }
    
    return sentCount;
  }

  /**
   * Close all connections for a user
   * @param {string} userId - User ID
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  closeUserConnections(userId, code = 1000, reason = 'Server shutdown') {
    if (this.clients.has(userId)) {
      const connections = this.clients.get(userId);
      for (const [connId, connection] of connections) {
        if (connection.ws.readyState === 1) {
          connection.ws.close(code, reason);
        }
        this.connectionMetadata.delete(connId);
        this.connectionCounter--;
      }
      this.clients.delete(userId);
      
      if (this.userMetadata.has(userId)) {
        this.userMetadata.get(userId).status = 'offline';
        this.userMetadata.get(userId).lastSeen = new Date();
      }
    }
  }

  /**
   * Close all connections
   * @param {number} code - Close code
   * @param {string} reason - Close reason
   */
  closeAllConnections(code = 1000, reason = 'Server shutdown') {
    for (const [userId] of this.clients) {
      this.closeUserConnections(userId, code, reason);
    }
  }

  /**
   * Clean up inactive connections (older than specified minutes)
   * @param {number} maxInactivityMinutes - Maximum inactivity in minutes
   * @returns {number} Number of connections cleaned up
   */
  cleanupInactiveConnections(maxInactivityMinutes = 30) {
    let cleanedCount = 0;
    const now = new Date();
    const inactiveThreshold = maxInactivityMinutes * 60 * 1000;
    
    for (const [userId, connections] of this.clients) {
      for (const [connId, connection] of connections) {
        const inactiveTime = now - connection.lastActivity;
        if (inactiveTime > inactiveThreshold) {
          if (connection.ws.readyState === 1) {
            connection.ws.close(1000, 'Connection timeout due to inactivity');
          }
          connections.delete(connId);
          this.connectionMetadata.delete(connId);
          this.connectionCounter--;
          cleanedCount++;
        }
      }
      
      if (connections.size === 0) {
        this.clients.delete(userId);
        if (this.userMetadata.has(userId)) {
          this.userMetadata.get(userId).status = 'offline';
          this.userMetadata.get(userId).lastSeen = new Date();
        }
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} inactive connections`);
    }
    
    return cleanedCount;
  }

  /**
   * Generate unique connection ID
   * @returns {string} Unique connection ID
   */
  generateConnectionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `conn_${timestamp}_${random}`;
  }

  /**
   * Get all connected user IDs
   * @returns {Array} Array of user IDs
   */
  getAllConnectedUserIds() {
    return Array.from(this.clients.keys());
  }

  /**
   * Get connection count for a specific user
   * @param {string} userId - User ID
   * @returns {number} Number of connections
   */
  getUserConnectionCount(userId) {
    return this.clients.has(userId) ? this.clients.get(userId).size : 0;
  }

  /**
   * Check if specific connection exists
   * @param {string} userId - User ID
   * @param {string} connectionId - Connection ID
   * @returns {boolean} True if connection exists
   */
  hasConnection(userId, connectionId) {
    return this.clients.has(userId) && this.clients.get(userId).has(connectionId);
  }

  /**
   * Get connection by ID
   * @param {string} connectionId - Connection ID
   * @returns {Object|null} Connection object or null
   */
  getConnectionById(connectionId) {
    const metadata = this.connectionMetadata.get(connectionId);
    if (!metadata) return null;
    
    const { userId } = metadata;
    if (this.clients.has(userId) && this.clients.get(userId).has(connectionId)) {
      return this.clients.get(userId).get(connectionId);
    }
    
    return null;
  }

  /**
   * Get all connection metadata
   * @returns {Array} Array of connection metadata
   */
  getAllConnectionMetadata() {
    return Array.from(this.connectionMetadata.values());
  }

  /**
   * Get all user metadata
   * @returns {Array} Array of user metadata
   */
  getAllUserMetadata() {
    return Array.from(this.userMetadata.values());
  }

  /**
   * Reset all client data (for testing)
   */
  reset() {
    this.clients.clear();
    this.userMetadata.clear();
    this.connectionMetadata.clear();
    this.connectionCounter = 0;
    console.log('🔄 WebSocket clients manager reset');
  }
}

module.exports = WebSocketClientsManager;