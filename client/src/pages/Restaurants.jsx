// import { useEffect, useState } from 'react';
// import API from '../api/api';
// import { useNavigate } from 'react-router-dom';

// export default function Restaurants() {
//   const [restaurants, setRestaurants] = useState([]);
//   const navigate = useNavigate();

//   // useEffect(() => {
//   //   API.get('/restaurants').then((res) =>
//   //     setRestaurants(res.data)
//   //   );
//   // }, []);

//   useEffect(() => {
//   navigator.geolocation.getCurrentPosition(
//     async (pos) => {
//       const { latitude, longitude } = pos.coords;

//       console.log('User Location:', latitude, longitude);

//       const res = await API.get(
//         `/restaurants?lat=${latitude}&lng=${longitude}`
//       );

//       console.log('API Data:', res.data);

//       setRestaurants(res.data);
//     },
//     async () => {
//       // fallback if permission denied
//       const res = await API.get('/restaurants');
//       setRestaurants(res.data);
//     }
//   );
// }, []);
//   return (
//     // <div>
//     //   <h2>Restaurants</h2>

//     //   {restaurants.map((r) => (
//     //     <div key={r._id} onClick={() => navigate(`/menu/${r._id}`)}>
//     //       <h3>{r.name}</h3>
//     //       <p>{r.cuisine}</p>
//     //     </div>
//     //   ))}
//     // </div>
//     <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
//   {restaurants.map((r) => (
//     <div
//       key={r._id}
//       onClick={() => navigate(`/menu/${r._id}`)}
//       className="bg-gray-900 p-5 rounded-2xl cursor-pointer hover:scale-105 transition"
//     >
//       <h3 className="text-xl font-semibold">{r.name}</h3>
//       <p className="text-gray-400">{r.cuisine}</p>
//       <p className="text-sm text-gray-400">
//       {r.distance < 1000
//         ? `${Math.round(r.distance)} m away`
//         : `${(r.distance / 1000).toFixed(1)} km away`}
//       </p>
//     </div>
//   ))}
// </div>
//   );
// }

// import { useEffect, useState } from "react";
// import API from "../api/api";
// import { useNavigate } from "react-router-dom";

// export default function Restaurants() {
//   const [restaurants, setRestaurants] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const navigate = useNavigate();

//   useEffect(() => {
//     navigator.geolocation.getCurrentPosition(
//       async (pos) => {
//         try {
//           const { latitude, longitude } = pos.coords;

//           const res = await API.get(
//             `/restaurants?lat=${latitude}&lng=${longitude}`
//           );

//           setRestaurants(res.data);
//         } catch (err) {
//           console.error(err);
//         } finally {
//           setLoading(false);
//         }
//       },
//       async () => {
//         try {
//           const res = await API.get("/restaurants");
//           setRestaurants(res.data);
//         } catch (err) {
//           console.error(err);
//         } finally {
//           setLoading(false);
//         }
//       }
//     );
//   }, []);

//   return (
//     <div className="max-w-7xl mx-auto px-4 py-6">

//       <h1 className="text-2xl font-semibold mb-6">
//         Restaurants Near You
//       </h1>

//       {loading ? (
//         <div className="grid md:grid-cols-3 gap-6">
//           {[1,2,3].map(i => (
//             <div key={i} className="h-40 bg-surface rounded-2xl animate-pulse" />
//           ))}
//         </div>
//       ) : (
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

//           {restaurants.map((r) => (
//             <div
//               key={r._id}
//               onClick={() => navigate(`/menu/${r._id}`)}
//               className="bg-surface border border-border p-5 rounded-2xl cursor-pointer 
//               hover:scale-[1.02] hover:bg-surfaceLight transition"
//             >
//               <h3 className="text-lg font-semibold">
//                 {r.name}
//               </h3>

//               <p className="text-textMuted mt-1">
//                 {r.cuisine}
//               </p>

//               <p className="text-sm text-textMuted mt-2">
//                 {r.distance < 1000
//                   ? `${Math.round(r.distance)} m away`
//                   : `${(r.distance / 1000).toFixed(1)} km away`}
//               </p>
//             </div>
//           ))}

//         </div>
//       )}

//     </div>
//   );
// }

import { useEffect, useState } from "react";
import API from "../api/api";
import RestaurantCard from "../components/RestaurantCard";

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;

          const res = await API.get(
            `/restaurants?lat=${latitude}&lng=${longitude}`
          );

          setRestaurants(res.data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      },
      async () => {
        try {
          const res = await API.get("/restaurants");
          setRestaurants(res.data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    );
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">

      {/* 🔥 TITLE */}
    <h1 className="heading-xl mb-6">
  Restaurants Near You
</h1>

      {/* ⏳ LOADING */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-60 bg-muted rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : (
        /* 🍽 GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {restaurants.map((r) => (
            <RestaurantCard key={r._id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}