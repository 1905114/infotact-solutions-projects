const express = require('express');
const { query } = require('express-validator');
const {
  getAdminDashboard,
  getPlatformAnalytics,
  getSystemHealth,
} = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// All dashboard routes require admin role
router.use(protect);
router.use(authorize('admin'));

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard metrics
 * @access  Private/Admin
 */
router.get('/dashboard', getAdminDashboard);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get platform analytics
 * @access  Private/Admin
 */
router.get('/analytics', [
  query('period').optional().isIn(['week', 'month', 'year']),
], getPlatformAnalytics);

/**
 * @route   GET /api/admin/health
 * @desc    Get system health metrics
 * @access  Private/Admin
 */
router.get('/health', getSystemHealth);

module.exports = router;