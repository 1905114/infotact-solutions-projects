const mongoose = require('mongoose');

/**
 * Menu Item Schema
 */
const menuItemSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Restaurant',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Appetizer', 'Main Course', 'Soup', 'Salad', 'Dessert',
        'Beverage', 'Bread', 'Rice', 'Noodles', 'Combo', 'Kids Meal'
      ],
    },
    subCategory: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative'],
    },
    discountedPrice: {
      type: Number,
      min: [0, 'Discounted price cannot be negative'],
      validate: {
        validator: function(value) {
          return !value || value <= this.price;
        },
        message: 'Discounted price must be less than or equal to regular price',
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    isVegan: {
      type: Boolean,
      default: false,
    },
    isGlutenFree: {
      type: Boolean,
      default: false,
    },
    spiceLevel: {
      type: String,
      enum: ['Mild', 'Medium', 'Hot', 'Extra Hot'],
      default: 'Medium',
    },
    ingredients: [{
      type: String,
    }],
    allergens: [{
      type: String,
      enum: ['Gluten', 'Dairy', 'Eggs', 'Nuts', 'Soy', 'Fish', 'Shellfish'],
    }],
    nutritionalInfo: {
      calories: Number,
      protein: Number,
      carbohydrates: Number,
      fat: Number,
      fiber: Number,
      sodium: Number,
    },
    images: [{
      type: String,
    }],
    preparationTime: {
      type: Number, // in minutes
      default: 15,
      min: 5,
      max: 60,
    },
    customizations: [{
      name: { type: String, required: true },
      options: [{
        name: { type: String, required: true },
        additionalPrice: { type: Number, default: 0 },
      }],
      isRequired: { type: Boolean, default: false },
      maxSelections: { type: Number, default: 1 },
    }],
    orderCount: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
menuItemSchema.index({ restaurantId: 1, category: 1 });
menuItemSchema.index({ restaurantId: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text' });
menuItemSchema.index({ price: 1 });
menuItemSchema.index({ isVegetarian: 1, isVegan: 1 });
menuItemSchema.index({ orderCount: -1 }); // For popular items

module.exports = mongoose.model('MenuItem', menuItemSchema);