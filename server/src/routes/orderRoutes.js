const express = require('express');
const router = express.Router();
const { adminOnly } = require('../middleware/restaurantMiddleware');
const {
  createOrder,
  getOrders,
  updateOrderStatus,
} = require('../controllers/orderController');

const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createOrder);
router.get('/', protect, getOrders);
// router.put('/:id', protect, updateOrderStatus);
router.put('/:id', protect, adminOnly, updateOrderStatus);
  

module.exports = router;