/**
 * Integration Tests
 * Tests complete user flows from cart to order completion
 */

const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Cart = require('../models/Cart');

describe('Integration Tests', () => {
  let authToken;
  let userId;
  let testRestaurant;
  let testMenuItem;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/food_test');
    
    // Create test user
    const user = await User.create({
      firstName: 'Integration',
      lastName: 'Tester',
      email: 'integration@test.com',
      phoneNumber: '+1234567890',
      password: 'Test123!',
      address: {
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        location: {
          type: 'Point',
          coordinates: [77.5946, 12.9716],
        },
      },
    });
    userId = user._id;
    
    // Create test restaurant
    testRestaurant = await Restaurant.create({
      name: 'Integration Test Restaurant',
      ownerId: userId,
      description: 'Test restaurant for integration',
      cuisineTypes: ['Italian'],
      address: {
        street: '456 Restaurant Ave',
        city: 'Test City',
        state: 'TS',
        postalCode: '12345',
        location: {
          type: 'Point',
          coordinates: [77.6000, 12.9800],
        },
      },
      priceRange: '$$',
      deliverySettings: {
        isDeliveryAvailable: true,
        minimumOrderAmount: 100,
        deliveryFee: 30,
        estimatedDeliveryTime: 30,
        deliveryRadius: 10,
      },
      contactInfo: { phone: '1234567890', email: 'restaurant@test.com' },
      images: { logo: 'logo.jpg', coverPhoto: 'cover.jpg' },
    });
    
    // Create test menu item
    testMenuItem = await MenuItem.create({
      restaurantId: testRestaurant._id,
      name: 'Test Pizza',
      description: 'Delicious test pizza',
      category: 'Main Course',
      price: 199,
      isAvailable: true,
    });
    
    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ email: 'integration@test.com', password: 'Test123!' });
    
    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Restaurant.deleteMany({});
    await MenuItem.deleteMany({});
    await Order.deleteMany({});
    await Cart.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Complete Order Flow', () => {
    test('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          menuItemId: testMenuItem._id,
          quantity: 2,
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items.length).toBe(1);
      expect(response.body.data.items[0].name).toBe('Test Pizza');
      expect(response.body.data.items[0].quantity).toBe(2);
    });

    test('should prevent adding from different restaurant', async () => {
      // Create another restaurant
      const otherRestaurant = await Restaurant.create({
        name: 'Other Restaurant',
        ownerId: userId,
        description: 'Other test restaurant',
        cuisineTypes: ['Chinese'],
        address: {
          street: '789 Other St',
          city: 'Test City',
          state: 'TS',
          postalCode: '12345',
          location: {
            type: 'Point',
            coordinates: [77.6100, 12.9900],
          },
        },
        priceRange: '$',
        deliverySettings: {
          isDeliveryAvailable: true,
          minimumOrderAmount: 50,
          deliveryFee: 20,
          estimatedDeliveryTime: 25,
          deliveryRadius: 8,
        },
        contactInfo: { phone: '1234567890', email: 'other@test.com' },
        images: { logo: 'logo.jpg', coverPhoto: 'cover.jpg' },
      });
      
      const otherMenuItem = await MenuItem.create({
        restaurantId: otherRestaurant._id,
        name: 'Other Dish',
        description: 'Other test dish',
        category: 'Appetizer',
        price: 99,
        isAvailable: true,
      });
      
      const response = await request(app)
        .post('/api/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          menuItemId: otherMenuItem._id,
          quantity: 1,
        });
      
      expect(response.status).toBe(409);
      expect(response.body.error).toBe('MULTI_RESTAURANT_CONFLICT');
    });

    test('should validate cart before checkout', async () => {
      const response = await request(app)
        .get('/api/cart/validate')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.isValid).toBe(true);
    });

    test('should create order from cart', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethod: 'cash',
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.order.orderNumber).toBeDefined();
      expect(response.body.data.order.totalAmount).toBeGreaterThan(0);
    });

    test('should get user orders', async () => {
      const response = await request(app)
        .get('/api/orders/my-orders')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });
  });

  describe('Restaurant Discovery', () => {
    test('should find nearby restaurants', async () => {
      const response = await request(app)
        .get('/api/restaurants/nearby')
        .query({ longitude: 77.5946, latitude: 12.9716, radius: 5 });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('should search restaurants by query', async () => {
      const response = await request(app)
        .get('/api/restaurants/search')
        .query({ query: 'pizza', cuisine: 'Italian' });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Review Flow', () => {
    let testOrderId;

    beforeAll(async () => {
      const order = await Order.findOne({ userId });
      testOrderId = order._id;
    });

    test('should create review for completed order', async () => {
      // First mark order as delivered
      await Order.findByIdAndUpdate(testOrderId, { status: 'delivered' });
      
      const response = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          restaurantId: testRestaurant._id,
          orderId: testOrderId,
          rating: 5,
          title: 'Excellent food!',
          content: 'The food was absolutely delicious. Great service and fast delivery. Will order again!',
          tags: ['taste', 'service'],
        });
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.pointsEarned).toBeGreaterThan(0);
    });

    test('should get AI suggestions for review', async () => {
      const response = await request(app)
        .post('/api/reviews/ai-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          restaurantId: testRestaurant._id,
          currentDraft: 'The pizza was',
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.keywords).toBeDefined();
    });
  });
});