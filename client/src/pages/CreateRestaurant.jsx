// import { useState } from 'react';
// import API from '../api/api';
// import MapComponent from '../components/MapComponent';

// export default function CreateRestaurant() {
//   const [form, setForm] = useState({
//     name: '',
//     cuisine: '',
//     lat: '',
//     lng: '',
//   });

//   const [loading, setLoading] = useState(false);

//   const getLocation = () => {
//     navigator.geolocation.getCurrentPosition(
//       (pos) => {
//         setForm((prev) => ({
//           ...prev,
//           lat: pos.coords.latitude,
//           lng: pos.coords.longitude,
//         }));
//       },
//       () => {
//         alert('Unable to fetch location');
//       }
//     );
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     if (!form.name || !form.cuisine || !form.lat || !form.lng) {
//       return alert('Please fill all fields and select location');
//     }

//     try {
//       setLoading(true);

//       await API.post('/restaurants', form);

//       alert('Restaurant created successfully');

//       setForm({
//         name: '',
//         cuisine: '',
//         lat: '',
//         lng: '',
//       });
//     } catch (err) {
//       alert(err.response?.data?.message || 'Error creating restaurant');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="p-6 max-w-lg mx-auto">
//       <h2 className="text-2xl mb-4">Create Restaurant</h2>

//       <form onSubmit={handleSubmit}>
//         <input
//           value={form.name}
//           placeholder="Restaurant Name"
//           className="w-full mb-3 p-2 text-black"
//           onChange={(e) =>
//             setForm({ ...form, name: e.target.value })
//           }
//         />

//         <input
//           value={form.cuisine}
//           placeholder="Cuisine"
//           className="w-full mb-3 p-2 text-black"
//           onChange={(e) =>
//             setForm({ ...form, cuisine: e.target.value })
//           }
//         />

//         {/* Current Location Button */}
//         <button
//           type="button"
//           onClick={getLocation}
//           className="bg-gray-700 text-white px-3 py-2 mb-3 w-full"
//         >
//           Use Current Location
//         </button>

//         {/* Map */}
//         <MapComponent setForm={setForm} />

//         {/* Coordinates */}
//         <p className="text-sm mt-3">
//           Lat: {form.lat || '-'} | Lng: {form.lng || '-'}
//         </p>

//         {/* Submit */}
//         <button
//           disabled={loading}
//           className="bg-white text-black px-4 py-2 w-full mt-4"
//         >
//           {loading ? 'Creating...' : 'Create Restaurant'}
//         </button>
//       </form>
//     </div>
//   );
// }

import { useState } from 'react';
import API from '../api/api';
import MapComponent from '../components/MapComponent';

export default function CreateRestaurant() {
  const [form, setForm] = useState({
    name: '',
    cuisine: '',
    lat: '',
    lng: '',
  });

  const [loading, setLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [position, setPosition] = useState([18.5204, 73.8567]);
 const getLocation = () => {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // update form
      setForm((prev) => ({
        ...prev,
        lat,
        lng,
      }));

      // move map
      setPosition([lat, lng]);
    },
    () => {
      alert('Unable to fetch location');
    }
  );
};

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.cuisine || !form.lat || !form.lng) {
      return alert('Please fill all fields and select location');
    }

    try {
      setLoading(true);

      await API.post('/restaurants', form);

      alert('Restaurant created successfully');

      setForm({
        name: '',
        cuisine: '',
        lat: '',
        lng: '',
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating restaurant');
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSearch = async () => {
  if (!locationQuery) return;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${locationQuery}`
    );

    const data = await res.json();

    if (data.length === 0) {
      return alert('Location not found');
    }

    const { lat, lon } = data[0];

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lon);

    // ✅ update form
    setForm((prev) => ({
      ...prev,
      lat: parsedLat,
      lng: parsedLng,
    }));

    // ✅ update map position (THIS WAS MISSING)
    setPosition([parsedLat, parsedLng]);

    alert('Location set from search!');
  } catch (err) {
    alert('Error searching location');
  }
};


  return (
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-2xl mb-4">Create Restaurant</h2>

      <form onSubmit={handleSubmit}>
        <input
          value={form.name}
          placeholder="Restaurant Name"
          className="w-full mb-3 p-2 text-black"
          onChange={(e) =>
            setForm({ ...form, name: e.target.value })
          }
        />

        <input
          value={form.cuisine}
          placeholder="Cuisine"
          className="w-full mb-3 p-2 text-black"
          onChange={(e) =>
            setForm({ ...form, cuisine: e.target.value })
          }
        />
        <button
        type="button"
        onClick={getLocation}
        className="bg-gray-700 text-white px-3 py-2 mb-3 w-full"
        >
        Use Current Location
        </button>
        {/* Current Location Button */}
        <button
          type="button"
          onClick={getLocation}
          className="bg-gray-700 text-white px-3 py-2 mb-3 w-full"
        >
          Use Current Location
        </button>

        <input
        value={locationQuery}
        placeholder="Search location (e.g. Pune, Mumbai)"
        className="w-full mb-3 p-2 text-black"
        onChange={(e) => setLocationQuery(e.target.value)}
        />

        <button
        type="button"
        onClick={handleLocationSearch}
        className="bg-blue-500 text-white px-3 py-2 mb-3 w-full"
        >
        Search Location
        </button>

        {/* Map */}
       <MapComponent
  setForm={setForm}
  position={position}
  setPosition={setPosition}
/>

        {/* Coordinates */}
        <p className="text-sm mt-3">
          Lat: {form.lat || '-'} | Lng: {form.lng || '-'}
        </p>

        {/* Submit */}
        <button
          disabled={loading}
          className="bg-white text-black px-4 py-2 w-full mt-4"
        >
          {loading ? 'Creating...' : 'Create Restaurant'}
        </button>
      </form>
    </div>
  );
}