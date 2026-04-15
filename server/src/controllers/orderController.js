const Order = require('../models/Order');
const Cart = require('../models/Cart');

// Create order from cart
exports.createOrder = async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const order = await Order.create({
      user: req.user._id,
      restaurant: cart.restaurant,
      items: cart.items,
    });

// emit real time updates
    global.io.emit('newOrder', {
        orderId: order._id,
        user: order.user,
    });

    // Clear cart after order
    await Cart.findOneAndDelete({ user: req.user._id });

    res.status(201).json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get user orders
// exports.getOrders = async (req, res) => {
//   const orders = await Order.find({ user: req.user._id }).populate(
//     'items.menuItem'
//   );
//   res.json(orders);
// };

exports.getOrders = async (req, res) => {
  try {
    let orders;

    // 👇 If admin → get all orders
    if (req.user.role === 'admin') {
      orders = await Order.find().populate('items.menuItem');
    } else {
      // 👇 If customer → only their orders
      orders = await Order.find({ user: req.user._id }).populate('items.menuItem');
    }

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update order status (for restaurant)
exports.updateOrderStatus = async (req, res) => {
  const { status } = req.body;

  const order = await Order.findById(req.params.id);

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  order.status = status;
  await order.save();

  console.log("Order updated:", order.status); // 👈 add this

  // 🔥 IMPORTANT: emit event
  global.io.emit('orderUpdated', {
    orderId: order._id,
    status: order.status,
  });

  res.json(order);
};