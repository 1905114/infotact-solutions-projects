/**
 * Order Tracking Service - Real-time order status and location tracking
 */

const Order = require('../models/Order');
const User = require('../models/User');
const GeospatialService = require('./geospatialService');

class OrderTrackingService {
  constructor() {
    this.activeDeliveries = new Map(); // orderId -> tracking data
    this.courierLocations = new Map(); // courierId -> last location
  }

  /**
   * Initialize tracking for an order
   */
  initializeTracking(orderId, courierId) {
    this.activeDeliveries.set(orderId, {
      orderId,
      courierId,
      status: 'active',
      startedAt: new Date(),
      lastUpdate: new Date(),
      locationHistory: [],
    });
  }

  /**
   * Update courier location
   */
  async updateCourierLocation(orderId, courierId, latitude, longitude) {
    if (!this.activeDeliveries.has(orderId)) {
      this.initializeTracking(orderId, courierId);
    }

    const tracking = this.activeDeliveries.get(orderId);
    tracking.lastUpdate = new Date();
    tracking.locationHistory.push({
      latitude,
      longitude,
      timestamp: new Date(),
    });

    // Keep only last 100 locations
    if (tracking.locationHistory.length > 100) {
      tracking.locationHistory.shift();
    }

    // Update courier location
    this.courierLocations.set(courierId, {
      latitude,
      longitude,
      lastUpdate: new Date(),
      orderId,
    });

    return tracking;
  }

  /**
   * Get order tracking data
   */
  async getOrderTracking(orderId, userId) {
    const order = await Order.findById(orderId)
      .populate('restaurantId', 'name address.location')
      .populate('deliveryPartnerId', 'firstName lastName phoneNumber');

    if (!order) {
      throw new Error('Order not found');
    }

    const tracking = this.activeDeliveries.get(orderId);
    
    // Calculate estimated remaining time
    let estimatedRemainingTime = null;
    if (order.status === 'out-for-delivery' && tracking && tracking.locationHistory.length > 0) {
      const lastLocation = tracking.locationHistory[tracking.locationHistory.length - 1];
      const deliveryAddress = order.deliveryAddress.location.coordinates;
      
      const distance = GeospatialService.calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        deliveryAddress[1],
        deliveryAddress[0],
        'km'
      );
      
      const avgSpeed = 30; // km/h
      estimatedRemainingTime = Math.ceil((distance / avgSpeed) * 60);
    }

    return {
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      orderPlacedAt: order.orderPlacedAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      estimatedRemainingTime,
      restaurant: {
        name: order.restaurantId.name,
        location: order.restaurantId.address.location.coordinates,
      },
      deliveryPartner: order.deliveryPartnerId ? {
        name: `${order.deliveryPartnerId.firstName} ${order.deliveryPartnerId.lastName}`,
        phone: order.deliveryPartnerId.phoneNumber,
        currentLocation: this.courierLocations.get(order.deliveryPartnerId._id.toString()),
      } : null,
      deliveryAddress: order.deliveryAddress,
      currentLocation: tracking?.locationHistory[tracking.locationHistory.length - 1] || null,
      locationHistory: tracking?.locationHistory.slice(-20) || [],
    };
  }

  /**
   * Stop tracking for an order
   */
  stopTracking(orderId) {
    if (this.activeDeliveries.has(orderId)) {
      this.activeDeliveries.delete(orderId);
      return true;
    }
    return false;
  }

  /**
   * Get nearby delivery partners
   */
  async getNearbyDeliveryPartners(latitude, longitude, radius = 5) {
    const nearbyPartners = [];
    
    for (const [courierId, location] of this.courierLocations) {
      const distance = GeospatialService.calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude,
        'km'
      );
      
      if (distance <= radius) {
        const courier = await User.findById(courierId).select('firstName lastName phoneNumber');
        if (courier && courier.isActive) {
          nearbyPartners.push({
            id: courierId,
            name: `${courier.firstName} ${courier.lastName}`,
            phone: courier.phoneNumber,
            distance: distance.toFixed(2),
            lastUpdate: location.lastUpdate,
          });
        }
      }
    }
    
    return nearbyPartners.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Get active deliveries count
   */
  getActiveDeliveriesCount() {
    return this.activeDeliveries.size;
  }

  /**
   * Get active deliveries for courier
   */
  getCourierActiveDelivery(courierId) {
    for (const [orderId, tracking] of this.activeDeliveries) {
      if (tracking.courierId === courierId) {
        return { orderId, ...tracking };
      }
    }
    return null;
  }

  /**
   * Simulate real-time location updates (for testing)
   */
  async simulateLocationUpdates(orderId, startLat, startLng, endLat, endLng, duration = 600000) {
    const steps = 20;
    const interval = duration / steps;
    let step = 0;
    
    const latStep = (endLat - startLat) / steps;
    const lngStep = (endLng - startLng) / steps;
    
    const intervalId = setInterval(async () => {
      if (step >= steps) {
        clearInterval(intervalId);
        return;
      }
      
      const currentLat = startLat + (latStep * step);
      const currentLng = startLng + (lngStep * step);
      
      const tracking = await this.updateCourierLocation(orderId, 'simulated_courier', currentLat, currentLng);
      step++;
    }, interval);
    
    return intervalId;
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    let totalDistance = 0;
    let totalDuration = 0;
    
    for (const [orderId, tracking] of this.activeDeliveries) {
      if (tracking.locationHistory.length > 1) {
        let orderDistance = 0;
        for (let i = 1; i < tracking.locationHistory.length; i++) {
          const prev = tracking.locationHistory[i - 1];
          const curr = tracking.locationHistory[i];
          orderDistance += GeospatialService.calculateDistance(
            prev.latitude, prev.longitude,
            curr.latitude, curr.longitude,
            'km'
          );
        }
        totalDistance += orderDistance;
        totalDuration += (tracking.lastUpdate - tracking.startedAt) / 1000;
      }
    }
    
    return {
      activeDeliveries: this.activeDeliveries.size,
      activeCouriers: this.courierLocations.size,
      totalDistance: totalDistance.toFixed(2),
      averageDistance: this.activeDeliveries.size > 0 
        ? (totalDistance / this.activeDeliveries.size).toFixed(2) 
        : 0,
      averageDuration: this.activeDeliveries.size > 0
        ? Math.round(totalDuration / this.activeDeliveries.size)
        : 0,
    };
  }
}

module.exports = new OrderTrackingService();