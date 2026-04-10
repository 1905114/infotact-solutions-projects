/**
 * Geospatial Service - Handles location-based calculations and proximity search
 */

const Restaurant = require('../models/Restaurant');

class GeospatialService {
  constructor() {
    this.earthRadiusKm = 6371;
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2, unit = 'km') {
    if (!lat1 || !lon1 || !lat2 || !lon2) {
      throw new Error('Invalid coordinates provided');
    }

    const R = unit === 'km' ? 6371 : unit === 'mi' ? 3959 : 6371000;
    const dLat = this.degToRad(lat2 - lat1);
    const dLon = this.degToRad(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degToRad(lat1)) * Math.cos(this.degToRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100;
  }

  /**
   * Convert degrees to radians
   */
  degToRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  radToDeg(radians) {
    return radians * (180 / Math.PI);
  }

  /**
   * Validate GeoJSON point coordinates
   */
  isValidGeoJSONPoint(coordinates) {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      return false;
    }
    
    const [longitude, latitude] = coordinates;
    return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
  }

  /**
   * Create GeoJSON point object
   */
  createGeoJSONPoint(longitude, latitude) {
    if (!this.isValidGeoJSONPoint([longitude, latitude])) {
      throw new Error('Invalid coordinates for GeoJSON point');
    }
    
    return {
      type: 'Point',
      coordinates: [longitude, latitude],
    };
  }

  /**
   * Get bounding box around a point
   */
  getBoundingBox(latitude, longitude, radiusKm) {
    const latDelta = (radiusKm / this.earthRadiusKm) * (180 / Math.PI);
    const minLat = latitude - latDelta;
    const maxLat = latitude + latDelta;
    
    const lonDelta = (radiusKm / (this.earthRadiusKm * Math.cos(this.degToRad(latitude)))) * (180 / Math.PI);
    const minLon = longitude - lonDelta;
    const maxLon = longitude + lonDelta;
    
    return { minLat, maxLat, minLon, maxLon };
  }

  /**
   * Generate MongoDB geospatial query for nearby locations
   */
  getNearbyQuery(longitude, latitude, maxDistanceMeters = 5000, locationField = 'address.location') {
    if (!this.isValidGeoJSONPoint([longitude, latitude])) {
      throw new Error('Invalid center coordinates');
    }
    
    return {
      [locationField]: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    };
  }

  /**
   * Find nearby restaurants with advanced sorting
   */
  async findNearbyRestaurants(params) {
    const {
      longitude,
      latitude,
      radius = 5,
      limit = 20,
      page = 1,
      sortBy = 'distance',
      cuisine,
      priceRange,
      minRating = 0,
      isOpen = false,
    } = params;

    const maxDistance = radius * 1000;
    const skip = (page - 1) * limit;

    const matchConditions = {
      isActive: true,
      'deliverySettings.isDeliveryAvailable': true,
      averageRating: { $gte: minRating },
    };

    if (cuisine) matchConditions.cuisineTypes = cuisine;
    if (priceRange) matchConditions.priceRange = priceRange;
    if (isOpen) matchConditions.isOpen = true;

    let sortConditions = {};
    let addFields = {};

    if (sortBy === 'rating') {
      sortConditions = { averageRating: -1, distance: 1 };
    } else if (sortBy === 'relevance') {
      addFields = {
        relevanceScore: {
          $add: [
            { $multiply: [{ $divide: ['$averageRating', 5] }, 0.6] },
            {
              $multiply: [
                { $subtract: [1, { $min: [{ $divide: ['$distance', maxDistance] }, 1] }] },
                0.4,
              ],
            },
          ],
        },
      };
      sortConditions = { relevanceScore: -1 };
    } else {
      sortConditions = { distance: 1 };
    }

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          distanceField: 'distance',
          maxDistance,
          spherical: true,
          key: 'address.location',
        },
      },
      { $match: matchConditions },
    ];

    if (sortBy === 'relevance') {
      pipeline.push({ $addFields: addFields });
    }

    pipeline.push(
      { $sort: sortConditions },
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $addFields: {
          distanceKm: { $divide: ['$distance', 1000] },
        },
      }
    );

    const restaurants = await Restaurant.aggregate(pipeline);
    const total = await Restaurant.countDocuments(matchConditions);

    return {
      restaurants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
      },
    };
  }

  /**
   * Calculate delivery feasibility and cost
   */
  async calculateDeliveryMetrics(restaurantId, customerCoordinates) {
    const [longitude, latitude] = customerCoordinates;

    const result = await Restaurant.aggregate([
      { $match: { _id: restaurantId } },
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          distanceField: 'distance',
          spherical: true,
          key: 'address.location',
        },
      },
    ]);

    if (!result[0]) return null;

    const restaurant = result[0];
    const distanceKm = restaurant.distance / 1000;
    const isDeliverable = distanceKm <= restaurant.deliverySettings.deliveryRadius;

    return {
      isDeliverable,
      distanceKm: distanceKm.toFixed(2),
      deliveryFee: isDeliverable ? restaurant.deliverySettings.deliveryFee : null,
      estimatedTime: isDeliverable
        ? Math.ceil(
            restaurant.deliverySettings.estimatedDeliveryTime + (distanceKm / 30) * 60
          )
        : null,
      minimumOrderAmount: restaurant.deliverySettings.minimumOrderAmount,
    };
  }

  /**
   * Check if point is within radius
   */
  isWithinRadius(lat1, lon1, lat2, lon2, radiusKm) {
    const distance = this.calculateDistance(lat1, lon1, lat2, lon2, 'km');
    return distance <= radiusKm;
  }

  /**
   * Sort locations by distance
   */
  sortByDistance(locations, centerLat, centerLon, coordPath = 'coordinates') {
    return locations.map(location => {
      let lat, lon;
      
      if (coordPath === 'coordinates') {
        [lon, lat] = location[coordPath];
      } else {
        lat = location[`${coordPath}.latitude`] || location[`${coordPath}.lat`];
        lon = location[`${coordPath}.longitude`] || location[`${coordPath}.lon`];
      }
      
      const distance = this.calculateDistance(centerLat, centerLon, lat, lon);
      return { ...location.toObject?.() || location, distance };
    }).sort((a, b) => a.distance - b.distance);
  }
}

module.exports = new GeospatialService();