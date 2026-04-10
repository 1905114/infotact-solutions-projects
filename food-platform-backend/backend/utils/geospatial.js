/**
 * GeoSpatial Utility Functions
 * For proximity search, distance calculation, and location-based operations
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point  
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @param {string} unit - 'km' for kilometers, 'm' for meters, 'mi' for miles
 * @returns {number} - Distance in specified unit
 */
const calculateDistance = (lat1, lon1, lat2, lon2, unit = 'km') => {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    throw new Error('Invalid coordinates provided');
  }

  const R = unit === 'km' ? 6371 : unit === 'mi' ? 3959 : 6371000;
  const dLat = degToRad(lat2 - lat1);
  const dLon = degToRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degToRad(lat1)) * Math.cos(degToRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100;
};

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} - Angle in radians
 */
const degToRad = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 * @param {number} radians - Angle in radians
 * @returns {number} - Angle in degrees
 */
const radToDeg = (radians) => {
  return radians * (180 / Math.PI);
};

/**
 * Validate GeoJSON point coordinates
 * @param {Array} coordinates - [longitude, latitude] array
 * @returns {boolean} - True if valid
 */
const isValidGeoJSONPoint = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }
  
  const [longitude, latitude] = coordinates;
  
  // Longitude: -180 to 180, Latitude: -90 to 90
  return longitude >= -180 && longitude <= 180 &&
         latitude >= -90 && latitude <= 90;
};

/**
 * Create GeoJSON point object
 * @param {number} longitude - Longitude coordinate
 * @param {number} latitude - Latitude coordinate
 * @returns {Object} - GeoJSON point object
 */
const createGeoJSONPoint = (longitude, latitude) => {
  if (!isValidGeoJSONPoint([longitude, latitude])) {
    throw new Error('Invalid coordinates for GeoJSON point');
  }
  
  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
};

/**
 * Get bounding box around a point
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} - Bounding box coordinates {minLat, maxLat, minLon, maxLon}
 */
const getBoundingBox = (latitude, longitude, radiusKm) => {
  const earthRadiusKm = 6371;
  
  // Latitude bounds
  const latDelta = (radiusKm / earthRadiusKm) * (180 / Math.PI);
  const minLat = latitude - latDelta;
  const maxLat = latitude + latDelta;
  
  // Longitude bounds (adjusted for latitude)
  const lonDelta = (radiusKm / (earthRadiusKm * Math.cos(degToRad(latitude)))) * (180 / Math.PI);
  const minLon = longitude - lonDelta;
  const maxLon = longitude + lonDelta;
  
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
  };
};

/**
 * Generate MongoDB geospatial query for nearby locations
 * @param {number} longitude - Center longitude
 * @param {number} latitude - Center latitude
 * @param {number} maxDistanceMeters - Maximum distance in meters
 * @param {string} locationField - Field name containing GeoJSON (default: 'address.location')
 * @returns {Object} - MongoDB geospatial query object
 */
const getNearbyQuery = (longitude, latitude, maxDistanceMeters = 5000, locationField = 'address.location') => {
  if (!isValidGeoJSONPoint([longitude, latitude])) {
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
};

/**
 * Generate MongoDB geospatial query for within polygon
 * @param {Array} polygonCoordinates - Array of [longitude, latitude] points
 * @param {string} locationField - Field name containing GeoJSON
 * @returns {Object} - MongoDB geospatial query object
 */
const getWithinPolygonQuery = (polygonCoordinates, locationField = 'address.location') => {
  if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length < 3) {
    throw new Error('Polygon must have at least 3 points');
  }
  
  return {
    [locationField]: {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [polygonCoordinates],
        },
      },
    },
  };
};

/**
 * Sort locations by distance from center
 * @param {Array} locations - Array of location objects with coordinates
 * @param {number} centerLat - Center latitude
 * @param {number} centerLon - Center longitude
 * @param {string} coordPath - Path to coordinates in location object
 * @returns {Array} - Sorted locations with distance property added
 */
const sortByDistance = (locations, centerLat, centerLon, coordPath = 'coordinates') => {
  return locations.map(location => {
    let lat, lon;
    
    if (coordPath === 'coordinates') {
      [lon, lat] = location[coordPath];
    } else {
      lat = location[`${coordPath}.latitude`] || location[`${coordPath}.lat`];
      lon = location[`${coordPath}.longitude`] || location[`${coordPath}.lon`];
    }
    
    const distance = calculateDistance(centerLat, centerLon, lat, lon);
    return { ...location.toObject?.() || location, distance };
  }).sort((a, b) => a.distance - b.distance);
};

/**
 * Check if a point is within a radius of another point
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} - True if within radius
 */
const isWithinRadius = (lat1, lon1, lat2, lon2, radiusKm) => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2, 'km');
  return distance <= radiusKm;
};

/**
 * Get delivery zone based on restaurant location and radius
 * @param {Object} restaurantLocation - Restaurant GeoJSON point
 * @param {number} deliveryRadiusKm - Delivery radius in kilometers
 * @returns {Object} - Delivery zone polygon (circle approximation)
 */
const getDeliveryZone = (restaurantLocation, deliveryRadiusKm) => {
  const [restaurantLon, restaurantLat] = restaurantLocation.coordinates;
  const points = [];
  const segments = 32; // Number of points to approximate circle
  
  for (let i = 0; i <= segments; i++) {
    const bearing = (i * 360 / segments) * (Math.PI / 180);
    const lat = Math.asin(
      Math.sin(degToRad(restaurantLat)) * Math.cos(deliveryRadiusKm / 6371) +
      Math.cos(degToRad(restaurantLat)) * Math.sin(deliveryRadiusKm / 6371) * Math.cos(bearing)
    );
    const lon = degToRad(restaurantLon) + Math.atan2(
      Math.sin(bearing) * Math.sin(deliveryRadiusKm / 6371) * Math.cos(degToRad(restaurantLat)),
      Math.cos(deliveryRadiusKm / 6371) - Math.sin(degToRad(restaurantLat)) * Math.sin(lat)
    );
    
    points.push([radToDeg(lon), radToDeg(lat)]);
  }
  
  return {
    type: 'Polygon',
    coordinates: [points],
  };
};

/**
 * Geocode address (mock - integrate with Google Maps/Mapbox in production)
 * @param {Object} address - Address object
 * @returns {Promise<Object>} - Coordinates and formatted address
 */
const geocodeAddress = async (address) => {
  // In production, use Google Maps Geocoding API, Mapbox, or OpenStreetMap
  // This is a mock implementation
  const { street, city, state, postalCode, country } = address;
  const fullAddress = `${street}, ${city}, ${state}, ${postalCode}, ${country}`;
  
  // Mock coordinates (replace with actual API call)
  console.log(`Geocoding address: ${fullAddress}`);
  
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        coordinates: [77.5946, 12.9716], // Bangalore coordinates (mock)
        formattedAddress: fullAddress,
        confidence: 0.9,
      });
    }, 100);
  });
};

/**
 * Reverse geocode coordinates to address
 * @param {number} longitude - Longitude
 * @param {number} latitude - Latitude
 * @returns {Promise<Object>} - Address object
 */
const reverseGeocode = async (longitude, latitude) => {
  // In production, use Google Maps Geocoding API
  // This is a mock implementation
  console.log(`Reverse geocoding: ${longitude}, ${latitude}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        street: 'MG Road',
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
        formattedAddress: 'MG Road, Bangalore, Karnataka 560001, India',
      });
    }, 100);
  });
};

/**
 * Validate if delivery address is within restaurant's delivery zone
 * @param {Object} restaurant - Restaurant object with location and deliveryRadius
 * @param {Object} deliveryAddress - Delivery address with coordinates
 * @returns {Promise<boolean>} - True if deliverable
 */
const isDeliverable = async (restaurant, deliveryAddress) => {
  const restaurantCoords = restaurant.address.location.coordinates;
  const deliveryCoords = deliveryAddress.location.coordinates;
  
  const [restaurantLon, restaurantLat] = restaurantCoords;
  const [deliveryLon, deliveryLat] = deliveryCoords;
  
  const distance = calculateDistance(
    restaurantLat, restaurantLon,
    deliveryLat, deliveryLon,
    'km'
  );
  
  return distance <= restaurant.deliverySettings.deliveryRadius;
};

/**
 * Get estimated delivery time based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @param {number} preparationTimeMins - Restaurant preparation time in minutes
 * @returns {Object} - Estimated time details
 */
const getEstimatedDeliveryTime = (distanceKm, preparationTimeMins = 15) => {
  // Assume average speed of 30 km/h in city
  const avgSpeedKmPerHour = 30;
  const travelTimeMins = (distanceKm / avgSpeedKmPerHour) * 60;
  
  const totalTimeMins = Math.ceil(preparationTimeMins + travelTimeMins);
  const totalTimeWithBuffer = Math.ceil(totalTimeMins * 1.2); // 20% buffer
  
  return {
    preparationTime: preparationTimeMins,
    travelTime: Math.ceil(travelTimeMins),
    totalTime: totalTimeMins,
    estimatedTimeWithBuffer: totalTimeWithBuffer,
    estimatedDeliveryTime: new Date(Date.now() + totalTimeWithBuffer * 60000),
  };
};

/**
 * Create geospatial index recommendations
 * @returns {Array} - Index creation commands
 */
const getGeospatialIndexRecommendations = () => {
  return [
    {
      collection: 'restaurants',
      index: { 'address.location': '2dsphere' },
      description: 'Enables proximity search for restaurants',
    },
    {
      collection: 'users',
      index: { 'address.location': '2dsphere' },
      description: 'Enables finding users by location',
    },
    {
      collection: 'orders',
      index: { 'deliveryAddress.location': '2dsphere' },
      description: 'Enables order routing based on location',
    },
    {
      collection: 'delivery_partners',
      index: { 'currentLocation': '2dsphere' },
      description: 'Enables finding nearby delivery partners',
    },
  ];
};

module.exports = {
  calculateDistance,
  degToRad,
  radToDeg,
  isValidGeoJSONPoint,
  createGeoJSONPoint,
  getBoundingBox,
  getNearbyQuery,
  getWithinPolygonQuery,
  sortByDistance,
  isWithinRadius,
  getDeliveryZone,
  geocodeAddress,
  reverseGeocode,
  isDeliverable,
  getEstimatedDeliveryTime,
  getGeospatialIndexRecommendations,
};