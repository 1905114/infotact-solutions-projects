/**
 * Validation Utility Functions
 * For input validation, sanitization, and data verification
 */

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if valid email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (international format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone number
 */
const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - Validation result with details
 */
const validatePasswordStrength = (password) => {
  const result = {
    isValid: false,
    score: 0,
    errors: [],
  };
  
  if (!password || password.length < 8) {
    result.errors.push('Password must be at least 8 characters long');
  } else {
    result.score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    result.errors.push('Password must contain at least one uppercase letter');
  } else {
    result.score += 1;
  }
  
  if (!/[a-z]/.test(password)) {
    result.errors.push('Password must contain at least one lowercase letter');
  } else {
    result.score += 1;
  }
  
  if (!/[0-9]/.test(password)) {
    result.errors.push('Password must contain at least one number');
  } else {
    result.score += 1;
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.errors.push('Password must contain at least one special character');
  } else {
    result.score += 1;
  }
  
  result.isValid = result.errors.length === 0;
  return result;
};

/**
 * Validate Indian PIN code (postal code)
 * @param {string} pincode - PIN code to validate
 * @returns {boolean} - True if valid PIN code
 */
const isValidPincode = (pincode) => {
  const pincodeRegex = /^[1-9][0-9]{5}$/;
  return pincodeRegex.test(pincode);
};

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid URL
 */
const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate MongoDB ObjectId
 * @param {string} id - ID to validate
 * @returns {boolean} - True if valid ObjectId
 */
const isValidObjectId = (id) => {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
};

/**
 * Validate restaurant price range
 * @param {string} priceRange - Price range ($, $$, $$$, $$$$)
 * @returns {boolean} - True if valid price range
 */
const isValidPriceRange = (priceRange) => {
  const validRanges = ['$', '$$', '$$$', '$$$$'];
  return validRanges.includes(priceRange);
};

/**
 * Validate cuisine type
 * @param {string} cuisine - Cuisine type to validate
 * @returns {boolean} - True if valid cuisine
 */
const isValidCuisine = (cuisine) => {
  const validCuisines = [
    'North Indian', 'South Indian', 'Chinese', 'Italian', 'Mexican',
    'Japanese', 'Thai', 'American', 'Mediterranean', 'Fusion',
    'Seafood', 'Vegetarian', 'Vegan', 'Desserts', 'Beverages',
  ];
  return validCuisines.includes(cuisine);
};

/**
 * Validate order status
 * @param {string} status - Order status to validate
 * @returns {boolean} - True if valid status
 */
const isValidOrderStatus = (status) => {
  const validStatuses = [
    'pending', 'confirmed', 'preparing', 'ready',
    'out-for-delivery', 'delivered', 'completed',
    'cancelled', 'refunded',
  ];
  return validStatuses.includes(status);
};

/**
 * Validate payment method
 * @param {string} method - Payment method to validate
 * @returns {boolean} - True if valid payment method
 */
const isValidPaymentMethod = (method) => {
  const validMethods = ['cash', 'card', 'upi', 'online'];
  return validMethods.includes(method);
};

/**
 * Validate rating (1-5)
 * @param {number} rating - Rating value
 * @returns {boolean} - True if valid rating
 */
const isValidRating = (rating) => {
  return typeof rating === 'number' && rating >= 1 && rating <= 5;
};

/**
 * Validate coordinates [longitude, latitude]
 * @param {Array} coordinates - Coordinate array
 * @returns {Object} - Validation result
 */
const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return { isValid: false, error: 'Coordinates must be an array of [longitude, latitude]' };
  }
  
  const [longitude, latitude] = coordinates;
  
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return { isValid: false, error: 'Longitude and latitude must be numbers' };
  }
  
  if (longitude < -180 || longitude > 180) {
    return { isValid: false, error: 'Longitude must be between -180 and 180' };
  }
  
  if (latitude < -90 || latitude > 90) {
    return { isValid: false, error: 'Latitude must be between -90 and 90' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Sanitize string input (prevent XSS)
 * @param {string} input - String to sanitize
 * @returns {string} - Sanitized string
 */
const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone number
 * @returns {string} - Sanitized phone number
 */
const sanitizePhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digit characters except '+'
  let sanitized = phone.replace(/[^\d+]/g, '');
  
  // Ensure it starts with + if international
  if (!sanitized.startsWith('+')) {
    sanitized = '+' + sanitized.replace(/^0+/, '');
  }
  
  return sanitized;
};

/**
 * Validate date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Object} - Validation result
 */
const validateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return { isValid: false, error: 'Both start and end dates are required' };
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'Invalid start date' };
  }
  
  if (isNaN(end.getTime())) {
    return { isValid: false, error: 'Invalid end date' };
  }
  
  if (start > end) {
    return { isValid: false, error: 'Start date must be before end date' };
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - Validated pagination params
 */
const validatePagination = (page, limit) => {
  const validatedPage = Math.max(1, parseInt(page) || 1);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  
  return {
    page: validatedPage,
    limit: validatedLimit,
    skip: (validatedPage - 1) * validatedLimit,
  };
};

/**
 * Validate menu item category
 * @param {string} category - Category to validate
 * @returns {boolean} - True if valid category
 */
const isValidMenuItemCategory = (category) => {
  const validCategories = [
    'Appetizer', 'Main Course', 'Soup', 'Salad', 'Dessert',
    'Beverage', 'Bread', 'Rice', 'Noodles', 'Combo', 'Kids Meal',
  ];
  return validCategories.includes(category);
};

/**
 * Validate dietary restriction
 * @param {string} restriction - Dietary restriction
 * @returns {boolean} - True if valid restriction
 */
const isValidDietaryRestriction = (restriction) => {
  const validRestrictions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
    'Nut-Free', 'Halal', 'Kosher', 'Low-Carb', 'Keto',
  ];
  return validRestrictions.includes(restriction);
};

/**
 * Validate time string (HH:MM format)
 * @param {string} timeString - Time string to validate
 * @returns {boolean} - True if valid time format
 */
const isValidTimeString = (timeString) => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
};

/**
 * Validate operating hours object
 * @param {Object} hours - Operating hours object
 * @returns {Object} - Validation result
 */
const validateOperatingHours = (hours) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (const day of days) {
    if (hours[day]) {
      if (!hours[day].isClosed) {
        if (!isValidTimeString(hours[day].open) || !isValidTimeString(hours[day].close)) {
          return {
            isValid: false,
            error: `Invalid time format for ${day}. Use HH:MM format`,
          };
        }
        
        if (hours[day].open >= hours[day].close) {
          return {
            isValid: false,
            error: `Closing time must be after opening time for ${day}`,
          };
        }
      }
    }
  }
  
  return { isValid: true, error: null };
};

/**
 * Validate order item quantity
 * @param {number} quantity - Quantity to validate
 * @returns {boolean} - True if valid quantity
 */
const isValidQuantity = (quantity) => {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 50;
};

/**
 * Validate discount percentage
 * @param {number} discount - Discount percentage
 * @returns {boolean} - True if valid discount
 */
const isValidDiscount = (discount) => {
  return typeof discount === 'number' && discount >= 0 && discount <= 100;
};

/**
 * Validate GST number (Indian format)
 * @param {string} gstNumber - GST number to validate
 * @returns {boolean} - True if valid GST number
 */
const isValidGSTNumber = (gstNumber) => {
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gstNumber);
};

/**
 * Validate FSSAI license number
 * @param {string} fssaiNumber - FSSAI number to validate
 * @returns {boolean} - True if valid FSSAI number
 */
const isValidFSSAINumber = (fssaiNumber) => {
  const fssaiRegex = /^[0-9]{14}$/;
  return fssaiRegex.test(fssaiNumber);
};

/**
 * Validate credit card number (Luhn algorithm)
 * @param {string} cardNumber - Credit card number
 * @returns {boolean} - True if valid card number
 */
const isValidCreditCard = (cardNumber) => {
  const sanitized = cardNumber.replace(/\s/g, '');
  
  if (!/^\d+$/.test(sanitized)) return false;
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

/**
 * Validate expiry date (MM/YY format)
 * @param {string} expiryDate - Expiry date string
 * @returns {boolean} - True if not expired
 */
const isValidExpiryDate = (expiryDate) => {
  const matches = expiryDate.match(/^(0[1-9]|1[0-2])\/([0-9]{2})$/);
  if (!matches) return false;
  
  const month = parseInt(matches[1], 10);
  const year = parseInt(matches[2], 10) + 2000;
  
  const expiry = new Date(year, month, 0, 23, 59, 59);
  const now = new Date();
  
  return expiry > now;
};

/**
 * Validate CVV
 * @param {string} cvv - CVV number
 * @returns {boolean} - True if valid CVV
 */
const isValidCVV = (cvv) => {
  const cvvRegex = /^[0-9]{3,4}$/;
  return cvvRegex.test(cvv);
};

module.exports = {
  isValidEmail,
  isValidPhoneNumber,
  validatePasswordStrength,
  isValidPincode,
  isValidUrl,
  isValidObjectId,
  isValidPriceRange,
  isValidCuisine,
  isValidOrderStatus,
  isValidPaymentMethod,
  isValidRating,
  validateCoordinates,
  sanitizeString,
  sanitizePhoneNumber,
  validateDateRange,
  validatePagination,
  isValidMenuItemCategory,
  isValidDietaryRestriction,
  isValidTimeString,
  validateOperatingHours,
  isValidQuantity,
  isValidDiscount,
  isValidGSTNumber,
  isValidFSSAINumber,
  isValidCreditCard,
  isValidExpiryDate,
  isValidCVV,
};