// import { useEffect, useState } from 'react';
// import API from '../api/api';
// import { useParams } from 'react-router-dom';
// import { ToastContainer, toast } from 'react-toastify';

// export default function Menu() {
//   const { id } = useParams();
//   const [menu, setMenu] = useState([]);

//   useEffect(() => {
//     API.get(`/menu/${id}`).then((res) =>
//       setMenu(res.data)
//     );
//   }, [id]);

// const addToCart = async (itemId) => {
//   try {
//     await API.post('/cart', {
//       menuItemId: itemId,
//       quantity: 1,
//     });
//     alert('Added to cart');
//     // toast.success("Added to cart")
//   } catch (err) {
//     alert(err.response?.data?.message);
//   }
// };

//   return (
//     // <div>
//     //   <h2>Menu</h2>

//     //   {menu.map((item) => (
//     //     <div key={item._id}>
//     //       <h4>{item.name}</h4>
//     //       <p>₹{item.price}</p>
//     //       <button onClick={() => addToCart(item._id)}>
//     //         Add to Cart
//     //       </button>
//     //     </div>
//     //   ))}
//     // </div>
//     <div className="p-6 grid md:grid-cols-2 gap-6">
//   {menu.map((item) => (
//     <div className="bg-gray-900 p-5 rounded-xl flex justify-between items-center">
//       <div>
//         <h4 className="text-lg">{item.name}</h4>
//         <p className="text-gray-400">₹{item.price}</p>
//       </div>

//       <button 
//         onClick={() => addToCart(item._id)}
//         className="bg-white text-black px-4 py-2 rounded-lg hover:opacity-80"
//         // className="bg-primary px-3 py-1 rounded-lg hover:scale-105 transition"
//       >
//         Add
//       </button>
//     </div>
//   ))}
// </div>
//   );
// }

// import { useEffect, useState } from "react";
// import API from "../api/api";
// import { useParams } from "react-router-dom";
// import MenuItemCard from "../components/features/MenuItemCard";

// export default function Menu() {
//   const { id } = useParams();
//   const [menu, setMenu] = useState([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchMenu = async () => {
//       try {
//         const res = await API.get(`/menu/${id}`);
//         setMenu(res.data);
//       } catch (err) {
//         console.error(err);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchMenu();
//   }, [id]);

//   return (
//     <div className="max-w-5xl mx-auto px-4 py-6 pb-24">

//       <h1 className="text-2xl font-semibold mb-6">
//         Menu
//       </h1>

//       {loading ? (
//         <div className="space-y-4">
//           {[1,2,3,4].map(i => (
//             <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />
//           ))}
//         </div>
//       ) : menu.length === 0 ? (
//         <div className="text-center text-textMuted py-20">
//           No items available
//         </div>
//       ) : (
//         <div className="space-y-4">
//           {menu.map((item) => (
//             <MenuItemCard key={item._id} item={item} />
//           ))}
//         </div>
//       )}

//     </div>
//   );
// }

// import { useEffect, useState } from "react";
// import API from "../api/api";
// import { useParams } from "react-router-dom";
// import MenuItemCard from "../components/features/MenuItemCard";

// export default function Menu() {
//   const { id } = useParams();
//   const [menu, setMenu] = useState([]);
//   const [restaurant, setRestaurant] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchData = async () => {
//   try {
//     const menuRes = await API.get(`/menu/${id}`);
//     console.log("MENU DATA:", menuRes.data);

//     setMenu(menuRes.data.menu || menuRes.data);
//   } catch (err) {
//     console.error(err);
//   }

//   try {
//     const restaurantRes = await API.get(`/restaurants/${id}`);
//     setRestaurant(restaurantRes.data);
//   } catch (err) {
//     console.error("Restaurant fetch failed");
//   }

//   setLoading(false);
// };

//     fetchData();
//   }, [id]);

//   return (
//     <div className="max-w-5xl mx-auto px-6 py-8 pb-28">

//       {/* 🔥 RESTAURANT HEADER */}
//       {restaurant && (
//         <div className="mb-8">
//           <h1 className="heading-xl">
//             {restaurant.name}
//           </h1>

//           <p className="body-sm mt-1">
//             {restaurant.cuisine}
//           </p>

//           <div className="flex items-center gap-4 mt-3 text-sm">
//             <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-md text-xs font-medium">
//               ⭐ 4.3
//             </span>

//             <span className="caption">
//               25–30 mins
//             </span>
//           </div>
//         </div>
//       )}

//       {/* 🔥 CONTENT */}
//       {loading ? (
//         <div className="space-y-4">
//           {[1, 2, 3, 4].map((i) => (
//             <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
//           ))}
//         </div>
//       ) : menu.length === 0 ? (
//         <div className="text-center caption py-20">
//           No items available
//         </div>
//       ) : (
//         <div className="space-y-6">
//           {menu.map((item) => (
//             <MenuItemCard key={item._id} item={item} />
//           ))}
//         </div>
//       )}

//       {/* 🛒 STICKY CART */}
//       <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-primary text-white rounded-xl px-6 py-3 flex justify-between items-center shadow-lg">
//         <span className="text-sm font-medium">
//           2 items added
//         </span>

//         <button className="text-sm font-semibold">
//           View Cart →
//         </button>
//       </div>

//     </div>
//   );
// }

import { useEffect, useState } from "react";
import API from "../api/api";
import { useParams } from "react-router-dom";
import MenuItemCard from "../components/features/MenuItemCard";

export default function Menu() {
  const { id } = useParams();
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    API.get(`/menu/${id}`).then((res) => {
      setMenu(res.data);
    });
  }, [id]);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">

      <h1 className="heading-xl mb-8">
        Menu
      </h1>

      <div className="space-y-6">
        {menu.map((item) => (
          <MenuItemCard key={item._id} item={item} />
        ))}
      </div>

    </div>
  );
}