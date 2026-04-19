// import { Link, useNavigate } from 'react-router-dom';
// import { useContext } from 'react';
// import { AuthContext } from '../context/AuthContext';

// export default function Navbar() {
//   const { user, logout } = useContext(AuthContext);
//   const navigate = useNavigate();

//   const handleLogout = () => {
//     logout();
//     navigate('/login'); // redirect after logout
//   };

//   return (
//     <div className="flex justify-between items-center px-6 py-4 bg-gray-900 border-b border-gray-800">
//       <h1 className="text-xl font-bold">Foodie</h1>

//       <div className="flex gap-6 items-center">
//         {user && (
//           <>
//           <Link to="/" className="flex">Home</Link>
//           <Link to="/cart" className="flex">Cart</Link>
//           <Link to="/orders" className="flex">Orders</Link>
//           <Link to="/create-restaurant" className="flex">Create Restaurant</Link>
//           <Link to="/admin" className="flex">Restaurant orders</Link>

//             <button
//               onClick={handleLogout}
//               className="bg-red-500 px-3 py-1 rounded-lg hover:opacity-80"
//             >
//               Logout
//             </button>
//           </>
//         )}

//         {!user && (
//           <>
//             <Link to="/login">Login</Link>
//             <Link to="/register">Register</Link>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }

import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const Navbar = () => {
  const { user } = useContext(AuthContext);

  return (
    <nav className="bg-card shadow-md sticky top-0 z-50">

      {/* 🧱 CONTAINER (IMPORTANT FIX) */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">

        {/* 🔥 LEFT */}
        <div className="flex items-center gap-6 flex-shrink-0">

          <Link to="/" className="text-2xl font-bold text-primary">
            Foodie
          </Link>

          <div className="hidden md:flex items-center text-sm text-muted">
            <span className="mr-1">📍</span>
            <span>Pune</span>
          </div>

        </div>

        {/* 🔍 CENTER (FIXED RESPONSIVE WIDTH) */}
        <div className="hidden md:flex flex-1 max-w-xl">
          <input
            type="text"
            placeholder="Search restaurants..."
            className="w-full px-4 py-2 rounded-lg bg-bg border border-gray-700 focus:outline-none focus:border-primary"
          />
        </div>

        {/* 👉 RIGHT */}
        <div className="flex items-center gap-5 flex-shrink-0">

          <Link to="/" className="text-muted hover:text-white transition">
            Home
          </Link>

          <Link to="/orders" className="text-muted hover:text-white transition">
            Orders
          </Link>

          {/* 🛒 Cart */}
          <Link to="/cart" className="relative">
            <span className="text-xl">🛒</span>
            <span className="absolute -top-2 -right-2 bg-primary text-xs px-1.5 py-0.5 rounded-full">
              2
            </span>
          </Link>

          {/* 👤 Auth */}
          {user ? (
            <span className="text-sm text-muted hidden sm:block">
              Hi, {user.name}
            </span>
          ) : (
            <Link
              to="/login"
              className="bg-primary px-4 py-2 rounded-lg text-white"
            >
              Login
            </Link>
          )}

        </div>

      </div>
    </nav>
  );
};

export default Navbar;