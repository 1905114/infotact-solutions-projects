/**
 * Geospatial Query Tests
 * Tests 2dsphere indexing and proximity search optimization
 */

const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const QueryOptimizer = require('../services/queryOptimizer');

describe('Geospatial Query Optimization', () => {
  let testRestaurants = [];

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/food_test');
    
    // Create test restaurants with various locations
    testRestaurants = await Restaurant.create([
      {
        name: 'Downtown Bistro',
        ownerId: new mongoose.Types.ObjectId(),
        description: 'Test restaurant 1',
        cuisineTypes: ['Italian'],
        address: {
          street: '123 Main St',
          city: 'Downtown',
          state: 'CA',
          postalCode: '90210',
          location: {
            type: 'Point',
            coordinates: [-118.2437, 34.0522],
          },
        },
        priceRange: '$$',
        deliverySettings: {
          isDeliveryAvailable: true,
          minimumOrderAmount: 10,
          deliveryFee: 2,
          estimatedDeliveryTime: 30,
          deliveryRadius: 10,
        },
        contactInfo: { phone: '1234567890', email: 'test@test.com' },
        images: { logo: 'logo.jpg', coverPhoto: 'cover.jpg' },
      },
      {
        name: 'Suburban Grill',
        ownerId: new mongoose.Types.ObjectId(),
        description: 'Test restaurant 2',
        cuisineTypes: ['American'],
        address: {
          street: '456 Oak Ave',
          city: 'Suburbia',
          state: 'CA',
          postalCode: '90211',
          location: {
            type: 'Point',
            coordinates: [-118.2500, 34.0600],
          },
        },
        priceRange: '$',
        deliverySettings: {
          isDeliveryAvailable: true,
          minimumOrderAmount: 5,
          deliveryFee: 1,
          estimatedDeliveryTime: 25,
          deliveryRadius: 5,
        },
        contactInfo: { phone: '1234567890', email: 'test2@test.com' },
        images: { logo: 'logo.jpg', coverPhoto: 'cover.jpg' },
      },
      {
        name: 'Far Away Cafe',
        ownerId: new mongoose.Types.ObjectId(),
        description: 'Test restaurant 3',
        cuisineTypes: ['Mexican'],
        address: {
          street: '789 Remote Rd',
          city: 'Farville',
          state: 'CA',
          postalCode: '90212',
          location: {
            type: 'Point',
            coordinates: [-118.3000, 34.1000],
          },
        },
        priceRange: '$$$',
        deliverySettings: {
          isDeliveryAvailable: true,
          minimumOrderAmount: 20,
          deliveryFee: 5,
          estimatedDeliveryTime: 45,
          deliveryRadius: 15,
        },
        contactInfo: { phone: '1234567890', email: 'test3@test.com' },
        images: { logo: 'logo.jpg', coverPhoto: 'cover.jpg' },
      },
    ]);
  });

  afterAll(async () => {
    await Restaurant.deleteMany({});
    await mongoose.connection.close();
  });

  describe('2dsphere Index Usage', () => {
    test('should use 2dsphere index for proximity queries', async () => {
      const query = {
        'address.location': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [-118.2437, 34.0522],
            },
            $maxDistance: 5000,
          },
        },
      };
      
      const analysis = await QueryOptimizer.analyzeQuery(Restaurant, query);
      
      expect(analysis.usesGeoIndex).toBe(true);
      expect(analysis.isCollectionScan).toBe(false);
      expect(analysis.efficiency).toBeGreaterThan(50);
    });

    test('should return restaurants sorted by distance', async () => {
      const restaurants = await Restaurant.findNearby(-118.2437, 34.0522, 10000);
      
      expect(restaurants).toBeDefined();
      expect(restaurants.length).toBeGreaterThan(0);
      
      // Check distance ordering
      for (let i = 1; i < restaurants.length; i++) {
        expect(restaurants[i].distance).toBeGreaterThanOrEqual(restaurants[i-1].distance);
      }
    });

    test('should respect maxDistance limit', async () => {
      const radius = 2000; // 2km
      const restaurants = await Restaurant.findNearby(-118.2437, 34.0522, radius);
      
      for (const restaurant of restaurants) {
        expect(restaurant.distance).toBeLessThanOrEqual(radius);
      }
    });
  });

  describe('Query Performance', () => {
    test('should execute geospatial query within acceptable time', async () => {
      const startTime = Date.now();
      
      await Restaurant.findNearby(-118.2437, 34.0522, 5000);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100); // Should be under 100ms
    });

    test('should have optimal execution stats', async () => {
      const query = {
        'address.location': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [-118.2437, 34.0522],
            },
            $maxDistance: 5000,
          },
        },
        isActive: true,
        averageRating: { $gte: 4 },
      };
      
      const analysis = await QueryOptimizer.analyzeQuery(Restaurant, query);
      
      expect(analysis.totalDocsExamined).toBeLessThan(100);
      expect(analysis.totalKeysExamined).toBeLessThan(1000);
      expect(analysis.efficiency).toBeGreaterThan(70);
    });
  });

  describe('Aggregation Pipeline Optimization', () => {
    test('should optimize $geoNear pipeline', async () => {
      const pipeline = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [-118.2437, 34.0522] },
            distanceField: 'distance',
            spherical: true,
            maxDistance: 5000,
          },
        },
        { $match: { isActive: true } },
        { $limit: 10 },
        { $sort: { distance: 1 } },
      ];
      
      const optimized = QueryOptimizer.optimizeAggregation(pipeline);
      
      // $match should be first
      expect(Object.keys(optimized[0])[0]).toBe('$geoNear');
    });
  });

  describe('Edge Cases', () => {
    test('should handle coordinates at antipodal points', async () => {
      const restaurants = await Restaurant.findNearby(0, 0, 20000000); // Half circumference
      
      expect(restaurants).toBeDefined();
      expect(Array.isArray(restaurants)).toBe(true);
    });

    test('should return empty array for no results', async () => {
      const restaurants = await Restaurant.findNearby(0, 0, 1); // 1 meter radius
      
      expect(restaurants).toEqual([]);
    });

    test('should handle invalid coordinates gracefully', async () => {
      await expect(Restaurant.findNearby(200, 200, 1000)).rejects.toThrow();
    });
  });
});