import { useState } from "react";
import API from "../../api/api";
import { toast } from "react-hot-toast";
import { useCart } from "../../context/CartContext";

export default function MenuItemCard({ item }) {
  const { addToCart: updateCart } = useCart();
  const [added, setAdded] = useState(false);

  const addToCart = async () => {
    try {
      await API.post("/cart", {
        menuItemId: item._id,
        quantity: 1,
      });

      updateCart(); // 🔥 update global cart

      setAdded(true);
      // toast.success("Added to cart");

      setTimeout(() => setAdded(false), 1200);
    } catch (err) {
      toast.error("Error adding item");
    }
  };

  return (
    <div
      className="flex justify-between items-center bg-card rounded-2xl p-4 
      hover:shadow-md transition-all duration-300"
    >
      {/* 📄 LEFT CONTENT */}
      <div className="flex-1 pr-4">
        <h3 className="heading-md">
          {item.name}
        </h3>

        <p className="body-sm mt-1">
          ₹{item.price}
        </p>

        <p className="caption mt-2">
          Freshly prepared & delicious
        </p>
      </div>

      {/* 🖼 RIGHT IMAGE + BUTTON */}
      <div className="relative w-24 h-24 flex-shrink-0">

        {/* IMAGE */}
        <img
          src={item.image || "https://via.placeholder.com/150"}
          alt={item.name}
          className="w-full h-full object-cover rounded-xl pointer-events-none"
        />

        {/* 🔥 ADD BUTTON */}
        <button
          onClick={addToCart}
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 
          px-4 py-1.5 rounded-lg text-sm font-semibold 
          transition-all duration-200 z-10 shadow-md
          
          ${
            added
              ? "bg-green-500 text-white scale-105"
              : "bg-white text-primary hover:shadow-lg active:scale-90"
          }`}
        >
          {added ? "✓ ADDED" : "ADD"}
        </button>
      </div>
    </div>
  );
}