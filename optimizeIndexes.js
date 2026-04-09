/**
 * MongoDB Index Optimization Script
 * Run this script to analyze and create optimal indexes
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function optimizeIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Get all collections
    const collections = await db.listCollections().toArray();

    for (const collection of collections) {
      const collName = collection.name;
      const coll = db.collection(collName);
      
      console.log(`\n📊 Analyzing collection: ${collName}`);
      
      // Get current indexes
      const indexes = await coll.indexes();
      console.log(`Current indexes: ${indexes.length}`);
      
      // Get collection stats
      const stats = await coll.stats();
      console.log(`Document count: ${stats.count}`);
      console.log(`Data size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Recommended indexes based on collection
      const recommendations = getRecommendedIndexes(collName);
      
      for (const rec of recommendations) {
        try {
          await coll.createIndex(rec.index, { name: rec.name });
          console.log(`✅ Created index: ${rec.name}`);
        } catch (error) {
          console.log(`⚠️ Index exists or error: ${rec.name}`);
        }
      }
    }
    
    console.log('\n✅ Index optimization completed');
    process.exit(0);
  } catch (error) {
    console.error('Error optimizing indexes:', error);
    process.exit(1);
  }
}

function getRecommendedIndexes(collectionName) {
  const recommendations = {
    users: [
      { name: 'idx_email', index: { email: 1 } },
      { name: 'idx_phone', index: { phoneNumber: 1 } },
      { name: 'idx_role_status', index: { role: 1, isActive: 1 } },
      { name: 'idx_location_2dsphere', index: { 'address.location': '2dsphere' } },
    ],
    restaurants: [
      { name: 'idx_location_2dsphere', index: { 'address.location': '2dsphere' } },
      { name: 'idx_cuisine_rating', index: { cuisineTypes: 1, averageRating: -1 } },
      { name: 'idx_name_text', index: { name: 'text', description: 'text' } },
      { name: 'idx_owner', index: { ownerId: 1 } },
      { name: 'idx_status', index: { isActive: 1, isOpen: 1 } },
    ],
    orders: [
      { name: 'idx_user_created', index: { userId: 1, createdAt: -1 } },
      { name: 'idx_restaurant_status', index: { restaurantId: 1, status: 1 } },
      { name: 'idx_delivery_partner', index: { deliveryPartnerId: 1, status: 1 } },
      { name: 'idx_order_number', index: { orderNumber: 1 } },
      { name: 'idx_status_created', index: { status: 1, createdAt: -1 } },
    ],
    menuitems: [
      { name: 'idx_restaurant_category', index: { restaurantId: 1, category: 1 } },
      { name: 'idx_restaurant_available', index: { restaurantId: 1, isAvailable: 1 } },
      { name: 'idx_name_text', index: { name: 'text' } },
    ],
    reviews: [
      { name: 'idx_restaurant_created', index: { restaurantId: 1, createdAt: -1 } },
      { name: 'idx_user_restaurant', index: { userId: 1, restaurantId: 1 }, unique: true },
      { name: 'idx_rating', index: { rating: -1 } },
      { name: 'idx_helpful', index: { helpfulCount: -1 } },
    ],
    carts: [
      { name: 'idx_user', index: { userId: 1 }, unique: true },
      { name: 'idx_expires', index: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ],
    transactions: [
      { name: 'idx_transaction_id', index: { transactionId: 1 }, unique: true },
      { name: 'idx_user_created', index: { userId: 1, createdAt: -1 } },
      { name: 'idx_order', index: { orderId: 1 } },
      { name: 'idx_status_created', index: { status: 1, createdAt: -1 } },
    ],
  };
  
  return recommendations[collectionName] || [];
}

// Run the optimization
optimizeIndexes();