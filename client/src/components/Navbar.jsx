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

import { Link, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { ShoppingCart, User, Search, MapPin } from "lucide-react";
import { useCart } from "../context/CartContext";
import { motion } from "framer-motion";

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { cartCount } = useCart();
  
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-border shadow-sm">

      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* 🔥 LEFT — BRAND + LOCATION */}
        <div className="flex items-center gap-6">

       <Link className="text-xl font-semibold tracking-tight text-primary">
  Foodie
</Link>

          {/* 📍 LOCATION */}
          <div className="hidden md:flex items-center gap-2 cursor-pointer group">
            <MapPin size={18} className="text-primary" />

            <div className="flex flex-col leading-tight">
              <span className="text-xs text-muted-foreground">
                Deliver to
              </span>
              <span className="text-sm font-medium group-hover:text-primary transition">
                Pune
              </span>
            </div>
          </div>

        </div>

        {/* 🔍 CENTER — SEARCH (upgraded) */}
        <div className="hidden md:flex flex-1 max-w-lg mx-8">

          <div className="flex items-center w-full bg-muted rounded-full px-4 py-2.5 
          focus-within:ring-2 focus-within:ring-primary/20 transition">

            <Search size={18} className="text-muted-foreground mr-3" />

            <input
              type="text"
              placeholder="Search for restaurants, cuisines..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

        </div>

        {/* 👉 RIGHT */}
        <div className="flex items-center gap-6">

          {user ? (
            <>
              {/* 🛒 CART */}
              <Link to="/cart" className="relative group">
                <ShoppingCart className="text-foreground/70 group-hover:text-primary transition" />

              {cartCount > 0 && (
                 <motion.span
  key={cartCount}
  initial={{ scale: 0.5 }}
  animate={{ scale: [1.3, 1] }}
  transition={{ duration: 0.25 }}
  className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shadow"
>
  {cartCount}
</motion.span>
                )}
              </Link>

              {/* 👤 USER */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <User size={16} />
                </div>
                <span className="body-sm">
  {user.name}
</span>
              </div>

              {/* 🚪 LOGOUT */}
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="text-sm text-muted-foreground hover:text-primary transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Login
              </Link>

              <Link
                to="/register"
                className="bg-primary text-white px-4 py-2 rounded-full text-sm hover:opacity-90 transition"
              >
                Sign up
              </Link>
            </>
          )}

        </div>
      </div>
    </nav>
  );
}