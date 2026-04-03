const express = require('express');
const router = express.Router();

const {
  addMenuItem,
  getMenu,
} = require('../controllers/menuController');

const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, addMenuItem);
router.get('/:restaurantId', getMenu);

module.exports = router;