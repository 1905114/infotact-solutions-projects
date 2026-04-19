const Restaurant = require('../models/Restaurant');

// Create restaurant
// exports.createRestaurant = async (req, res) => {
//   try {
//     const { name, cuisine, location } = req.body;

//     const restaurant = await Restaurant.create({
//       name,
//       cuisine,
//       location,
//       owner: req.user._id,
//     });

//     res.status(201).json(restaurant);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.createRestaurant = async (req, res) => {
  try {
    const { name, cuisine, lat, lng } = req.body;

    const restaurant = await Restaurant.create({
      name,
      cuisine,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      owner: req.user._id,
    });

    res.status(201).json(restaurant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all restaurants (with basic filters)
// exports.getRestaurants = async (req, res) => {
//   try {
//     const { cuisine, rating } = req.query;

//     let filter = {};

//     if (cuisine) filter.cuisine = cuisine;
//     if (rating) filter.rating = { $gte: Number(rating) };

//     const restaurants = await Restaurant.find(filter);

//     res.json(restaurants);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// exports.getRestaurants = async (req, res) => {
//   try {
//     const { lat, lng } = req.query;

//     let restaurants;

//     if (lat && lng) {
//       restaurants = await Restaurant.find({
//         location: {
//           $near: {
//             $geometry: {
//               type: 'Point',
//               coordinates: [parseFloat(lng), parseFloat(lat)],
//             },
//             $maxDistance: 5000, // 5 km
//           },
//         },
//       });
//     } else {
//       restaurants = await Restaurant.find();
//     }

//     res.json(restaurants);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

exports.getRestaurants = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    let restaurants;

    if (lat && lng) {
      restaurants = await Restaurant.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)],
            },
            distanceField: 'distance',
            maxDistance: 5000, // 5 km
            spherical: true,
          },
        },
      ]);
    } else {
      restaurants = await Restaurant.find();
    }

    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};