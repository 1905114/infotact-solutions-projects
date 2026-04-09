const mongoose = require('mongoose');

/**
 * Restaurant Schema with GeoJSON support for proximity search
 */
const restaurantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Restaurant name is required'],
      trim: true,
      unique: true,
      minlength: [3, 'Restaurant name must be at least 3 characters'],
      maxlength: [100, 'Restaurant name cannot exceed 100 characters'],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    cuisineTypes: [{
      type: String,
      required: true,
      enum: [
        'North Indian', 'South Indian', 'Chinese', 'Italian', 'Mexican',
        'Japanese', 'Thai', 'American', 'Mediterranean', 'Fusion',
        'Seafood', 'Vegetarian', 'Vegan', 'Desserts', 'Beverages'
      ],
    }],
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true, default: 'India' },
      landmark: { type: String },
      
      // GeoJSON Point - Critical for proximity search
      location: {
        type: {
          type: String,
          enum: ['Point'],
          required: true,
          default: 'Point',
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          required: [true, 'Location coordinates are required'],
          validate: {
            validator: function(coords) {
              return coords.length === 2 &&
                     coords[0] >= -180 && coords[0] <= 180 &&
                     coords[1] >= -90 && coords[1] <= 90;
            },
            message: 'Invalid coordinates. Must be [longitude, latitude]',
          },
        },
      },
    },
    
    // Operating hours
    operatingHours: {
      monday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      friday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, isClosed: { type: Boolean, default: false } },
    },
    
    // Contact information
    contactInfo: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
      website: String,
    },
    
    // Pricing and ratings
    priceRange: {
      type: String,
      enum: ['$', '$$', '$$$', '$$$$'],
      required: true,
    },
    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
      set: (val) => Math.round(val * 10) / 10, // Round to 1 decimal
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
    
    // Delivery settings
    deliverySettings: {
      isDeliveryAvailable: { type: Boolean, default: true },
      isDineInAvailable: { type: Boolean, default: true },
      isTakeawayAvailable: { type: Boolean, default: true },
      minimumOrderAmount: { type: Number, required: true, min: 0 },
      deliveryFee: { type: Number, required: true, min: 0 },
      estimatedDeliveryTime: { type: Number, required: true, min: 15 }, // in minutes
      deliveryRadius: { type: Number, required: true, min: 1, max: 25 }, // in kilometers
    },
    
    // Images
    images: {
      logo: { type: String, required: true },
      coverPhoto: { type: String, required: true },
      gallery: [{ type: String }],
    },
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isOpen: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    
    // Additional metadata
    features: [{
      type: String,
      enum: ['Outdoor Seating', 'Air Conditioning', 'Wi-Fi', 'Parking', 'Wheelchair Accessible', 'Pet Friendly'],
    }],
    paymentMethods: [{
      type: String,
      enum: ['Cash', 'Card', 'UPI', 'Online'],
      default: ['Cash', 'Card', 'UPI', 'Online'],
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// CRITICAL: Create 2dsphere index for geospatial proximity queries
restaurantSchema.index({ 'address.location': '2dsphere' });

// Other indexes for query optimization
restaurantSchema.index({ cuisineTypes: 1 });
restaurantSchema.index({ averageRating: -1 });
restaurantSchema.index({ priceRange: 1 });
restaurantSchema.index({ isOpen: 1, isActive: 1 });
restaurantSchema.index({ name: 'text', description: 'text' }); // Text search

/**
 * Virtual field for menu items
 */
restaurantSchema.virtual('menuItems', {
  ref: 'MenuItem',
  localField: '_id',
  foreignField: 'restaurantId',
});

/**
 * Method to check if restaurant is open at given time
 */
restaurantSchema.methods.isOpenAt = function(day, time) {
  const hours = this.operatingHours[day.toLowerCase()];
  if (hours.isClosed) return false;
  return time >= hours.open && time <= hours.close;
};

/**
 * Static method to find nearby restaurants
 */
restaurantSchema.statics.findNearby = async function(longitude, latitude, maxDistance = 5000) {
  return this.find({
    'address.location': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        $maxDistance: maxDistance, // in meters
      },
    },
    isActive: true,
    'deliverySettings.isDeliveryAvailable': true,
  });
};

module.exports = mongoose.model('Restaurant', restaurantSchema);