/**
 * Database Seeding Script
 * Populates database with test data for development
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// Import models
const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const Review = require('../models/Review');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Restaurant.deleteMany({}),
      MenuItem.deleteMany({}),
      Order.deleteMany({}),
      Review.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create admin user
    const admin = await User.create({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@foodplatform.com',
      phoneNumber: '+911234567890',
      password: await bcrypt.hash('Admin123!', 10),
      role: 'admin',
      isActive: true,
      address: {
        street: 'Admin Street',
        city: 'Admin City',
        state: 'Admin State',
        postalCode: '000000',
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      },
    });

    // Create restaurant owner
    const owner = await User.create({
      firstName: 'Restaurant',
      lastName: 'Owner',
      email: 'owner@foodplatform.com',
      phoneNumber: '+911234567891',
      password: await bcrypt.hash('Owner123!', 10),
      role: 'restaurant_owner',
      isActive: true,
      address: {
        street: 'Owner Street',
        city: 'Owner City',
        state: 'Owner State',
        postalCode: '000001',
        location: { type: 'Point', coordinates: [77.6000, 12.9800] },
      },
    });

    // Create test customer
    const customer = await User.create({
      firstName: 'Test',
      lastName: 'Customer',
      email: 'customer@foodplatform.com',
      phoneNumber: '+911234567892',
      password: await bcrypt.hash('Customer123!', 10),
      role: 'customer',
      isActive: true,
      address: {
        street: 'Customer Street',
        city: 'Customer City',
        state: 'Customer State',
        postalCode: '000002',
        location: { type: 'Point', coordinates: [77.5900, 12.9750] },
      },
    });

    // Create restaurants
    const restaurants = await Restaurant.create([
      {
        name: 'Pizza Paradise',
        ownerId: owner._id,
        description: 'Best pizza in town with authentic Italian ingredients',
        cuisineTypes: ['Italian', 'Fusion'],
        address: {
          street: '123 Pizza Lane',
          city: 'Food City',
          state: 'Food State',
          postalCode: '100001',
          location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        },
        priceRange: '$$',
        deliverySettings: {
          isDeliveryAvailable: true,
          isDineInAvailable: true,
          isTakeawayAvailable: true,
          minimumOrderAmount: 199,
          deliveryFee: 30,
          estimatedDeliveryTime: 35,
          deliveryRadius: 8,
        },
        contactInfo: {
          phone: '+911234567890',
          email: 'pizza@paradise.com',
        },
        images: {
          logo: 'https://example.com/logo.jpg',
          coverPhoto: 'https://example.com/cover.jpg',
        },
        isActive: true,
        isOpen: true,
        isVerified: true,
        averageRating: 4.5,
        totalReviews: 120,
      },
      {
        name: 'Burger King',
        ownerId: owner._id,
        description: 'Juicy burgers and crispy fries',
        cuisineTypes: ['American', 'Fast Food'],
        address: {
          street: '456 Burger Ave',
          city: 'Food City',
          state: 'Food State',
          postalCode: '100002',
          location: { type: 'Point', coordinates: [77.6000, 12.9800] },
        },
        priceRange: '$',
        deliverySettings: {
          isDeliveryAvailable: true,
          isDineInAvailable: true,
          isTakeawayAvailable: true,
          minimumOrderAmount: 99,
          deliveryFee: 25,
          estimatedDeliveryTime: 25,
          deliveryRadius: 6,
        },
        contactInfo: {
          phone: '+911234567891',
          email: 'contact@burgerking.com',
        },
        images: {
          logo: 'https://example.com/logo2.jpg',
          coverPhoto: 'https://example.com/cover2.jpg',
        },
        isActive: true,
        isOpen: true,
        isVerified: true,
        averageRating: 4.2,
        totalReviews: 85,
      },
    ]);

    // Create menu items
    const menuItems = [];
    for (const restaurant of restaurants) {
      const items = await MenuItem.create([
        {
          restaurantId: restaurant._id,
          name: restaurant.name === 'Pizza Paradise' ? 'Margherita Pizza' : 'Classic Burger',
          description: restaurant.name === 'Pizza Paradise' 
            ? 'Fresh mozzarella, tomato sauce, and basil' 
            : '100% beef patty with lettuce, tomato, and special sauce',
          category: restaurant.name === 'Pizza Paradise' ? 'Main Course' : 'Main Course',
          price: restaurant.name === 'Pizza Paradise' ? 299 : 149,
          isAvailable: true,
          isVegetarian: true,
          preparationTime: 15,
        },
        {
          restaurantId: restaurant._id,
          name: restaurant.name === 'Pizza Paradise' ? 'Pepperoni Pizza' : 'Chicken Burger',
          description: restaurant.name === 'Pizza Paradise' 
            ? 'Pepperoni, mozzarella, and tomato sauce' 
            : 'Grilled chicken breast with lettuce and mayo',
          category: 'Main Course',
          price: restaurant.name === 'Pizza Paradise' ? 399 : 179,
          isAvailable: true,
          isVegetarian: false,
          preparationTime: 15,
        },
        {
          restaurantId: restaurant._id,
          name: restaurant.name === 'Pizza Paradise' ? 'Garlic Bread' : 'French Fries',
          description: restaurant.name === 'Pizza Paradise' 
            ? 'Toasted bread with garlic butter' 
            : 'Crispy golden fries with seasoning',
          category: 'Appetizer',
          price: restaurant.name === 'Pizza Paradise' ? 99 : 89,
          isAvailable: true,
          isVegetarian: true,
          preparationTime: 10,
        },
      ]);
      menuItems.push(...items);
    }

    // Create sample orders
    const orders = [];
    for (let i = 0; i < 10; i++) {
      const restaurant = restaurants[Math.floor(Math.random() * restaurants.length)];
      const items = menuItems.filter(item => item.restaurantId.toString() === restaurant._id.toString());
      const selectedItems = items.slice(0, 2);
      
      const subtotal = selectedItems.reduce((sum, item) => sum + item.price, 0);
      const tax = subtotal * 0.05;
      const deliveryFee = restaurant.deliverySettings.deliveryFee;
      const totalAmount = subtotal + tax + deliveryFee;
      
      const order = await Order.create({
        orderNumber: await Order.generateOrderNumber(),
        userId: customer._id,
        restaurantId: restaurant._id,
        orderType: 'delivery',
        items: selectedItems.map(item => ({
          menuItemId: item._id,
          name: item.name,
          quantity: 1,
          unitPrice: item.price,
          totalPrice: item.price,
          customizations: [],
        })),
        subtotal,
        tax,
        deliveryFee,
        totalAmount,
        paymentMethod: 'cash',
        paymentStatus: 'completed',
        status: i < 5 ? 'delivered' : i < 8 ? 'confirmed' : 'pending',
        deliveryAddress: customer.address,
        orderPlacedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
      });
      orders.push(order);
    }

    // Create reviews
    for (let i = 0; i < 5; i++) {
      await Review.create({
        userId: customer._id,
        restaurantId: restaurants[0]._id,
        orderId: orders[i]._id,
        rating: 4 + Math.random(),
        title: 'Great experience!',
        content: 'The food was delicious and delivery was fast. Highly recommend!',
        isVerifiedPurchase: true,
        status: 'approved',
        publishedAt: new Date(),
      });
    }

    console.log('✅ Seeding completed!');
    console.log(`Created: ${await User.countDocuments()} users`);
    console.log(`Created: ${await Restaurant.countDocuments()} restaurants`);
    console.log(`Created: ${await MenuItem.countDocuments()} menu items`);
    console.log(`Created: ${await Order.countDocuments()} orders`);
    console.log(`Created: ${await Review.countDocuments()} reviews`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();