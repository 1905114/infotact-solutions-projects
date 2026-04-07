import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <div className="flex justify-between items-center px-6 py-4 bg-gray-900 border-b border-gray-800">
      <h1 className="text-xl font-bold">Foodie</h1>

      <div className="flex gap-6">
        <Link to="/">Home</Link>
        <Link to="/cart">Cart</Link>
        <Link to="/orders">Orders</Link>
      </div>
    </div>
  );
}