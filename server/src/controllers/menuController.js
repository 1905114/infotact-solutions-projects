const MenuItem = require('../models/MenuItem');

// Add item
exports.addMenuItem = async (req, res) => {
  try {
    const { name, price, restaurantId } = req.body;

    const item = await MenuItem.create({
      name,
      price,
      restaurant: restaurantId,
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get menu by restaurant
exports.getMenu = async (req, res) => {
  try {
    const menu = await MenuItem.find({
      restaurant: req.params.restaurantId,
    });

    res.json(menu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};