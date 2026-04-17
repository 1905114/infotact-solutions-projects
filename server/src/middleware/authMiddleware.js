const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  // console.log("AUTH HEADER:", req.headers.authorization);

  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // console.log("DECODED:", decoded);

      req.user = await User.findById(decoded.id).select('-password');
      // console.log("USER FOUND:", req.user);

      next();
    } catch (error) {
      // console.log("AUTH ERROR:", error.message);
      return res.status(401).json({ message: 'Not authorized' });
    }
  }

  if (!token) {
    // console.log("NO TOKEN");
    return res.status(401).json({ message: 'No token' });
  }
};