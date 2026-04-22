import { Link } from "react-router-dom";

const CartBar = () => {
  const items = 2;
  const total = 348;

  if (!items) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4">

      <div className="max-w-7xl mx-auto flex justify-between items-center">

        <div>
          <p className="text-sm text-textMuted">
            {items} items
          </p>
          <p className="font-semibold">₹{total}</p>
        </div>

        <Link
          to="/cart"
          className="bg-primary px-6 py-3 rounded-xl"
        >
          View Cart
        </Link>

      </div>

    </div>
  );
};

export default CartBar;