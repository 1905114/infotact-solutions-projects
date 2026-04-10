/**
 * WebSocket Event Definitions
 * Standardized event types for real-time communication
 */

const WebSocketEvents = {
  // Connection events
  CONNECTION_ESTABLISHED: 'CONNECTION_ESTABLISHED',
  CONNECTION_CLOSED: 'CONNECTION_CLOSED',
  
  // Order status events
  ORDER_PENDING: 'ORDER_PENDING',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_PREPARING: 'ORDER_PREPARING',
  ORDER_READY: 'ORDER_READY',
  ORDER_OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_COMPLETED: 'ORDER_COMPLETED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_REFUNDED: 'ORDER_REFUNDED',
  
  // Courier events
  COURIER_ASSIGNED: 'COURIER_ASSIGNED',
  COURIER_ARRIVED: 'COURIER_ARRIVED',
  COURIER_PICKED_UP: 'COURIER_PICKED_UP',
  COURIER_LOCATION_UPDATE: 'COURIER_LOCATION_UPDATE',
  
  // Restaurant events
  RESTAURANT_OPEN_STATUS: 'RESTAURANT_OPEN_STATUS',
  MENU_ITEM_UPDATED: 'MENU_ITEM_UPDATED',
  
  // User events
  USER_NOTIFICATION: 'USER_NOTIFICATION',
  CART_EXPIRY_WARNING: 'CART_EXPIRY_WARNING',
  
  // System events
  ERROR: 'ERROR',
  PING: 'PING',
  PONG: 'PONG',
};

/**
 * Create order status event payload
 */
const createOrderStatusEvent = (order, oldStatus, newStatus, updatedBy) => {
  return {
    event: WebSocketEvents[`ORDER_${newStatus.toUpperCase()}`] || `ORDER_${newStatus.toUpperCase()}`,
    orderId: order._id,
    orderNumber: order.orderNumber,
    previousStatus: oldStatus,
    currentStatus: newStatus,
    updatedBy: {
      id: updatedBy._id || updatedBy.id,
      name: updatedBy.name || updatedBy.firstName,
      role: updatedBy.role,
    },
    timestamp: new Date().toISOString(),
    estimatedDeliveryTime: order.deliveredAt || order.estimatedDeliveryTime,
    metadata: {
      restaurantName: order.restaurantId?.name,
      totalAmount: order.totalAmount,
    },
  };
};

/**
 * Create courier location update event
 */
const createCourierLocationEvent = (orderId, courierId, location) => {
  return {
    event: WebSocketEvents.COURIER_LOCATION_UPDATE,
    orderId,
    courierId,
    location: {
      lat: location.latitude,
      lng: location.longitude,
      accuracy: location.accuracy,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Create user notification event
 */
const createNotificationEvent = (userId, title, message, type, data = {}) => {
  return {
    event: WebSocketEvents.USER_NOTIFICATION,
    userId,
    title,
    message,
    type, // 'info', 'success', 'warning', 'error'
    timestamp: new Date().toISOString(),
    data,
  };
};

module.exports = {
  WebSocketEvents,
  createOrderStatusEvent,
  createCourierLocationEvent,
  createNotificationEvent,
};