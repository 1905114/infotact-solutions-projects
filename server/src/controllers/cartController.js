const Cart = require('../models/Cart');
const MenuItem = require('../models/MenuItem');

// Add to cart
exports.addToCart = async (req, res) => {
  try {
    const { menuItemId, quantity } = req.body;

    const menuItem = await MenuItem.findById(menuItemId).populate('restaurant');

    if (!menuItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    let cart = await Cart.findOne({ user: req.user._id });

    // If no cart → create one
    if (!cart) {
      cart = await Cart.create({
        user: req.user._id,
        restaurant: menuItem.restaurant._id,
        items: [{ menuItem: menuItemId, quantity }],
      });
    } else {
      // IMPORTANT RULE: Only one restaurant
      if (cart.restaurant.toString() !== menuItem.restaurant._id.toString()) {
        return res.status(400).json({
          message: 'You can only order from one restaurant at a time',
        });
      }

      // Check if item exists → update quantity
      const itemIndex = cart.items.findIndex(
        (item) => item.menuItem.toString() === menuItemId
      );

      if (itemIndex > -1) {
        cart.items[itemIndex].quantity += quantity;
      } else {
        cart.items.push({ menuItem: menuItemId, quantity });
      }

      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get cart
exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate(
      'items.menuItem'
    );

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Clear cart
exports.clearCart = async (req, res) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.json({ message: 'Cart cleared' });
};