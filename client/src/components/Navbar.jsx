import { Link, useNavigate } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login'); // redirect after logout
  };

  return (
    <div className="flex justify-between items-center px-6 py-4 bg-gray-900 border-b border-gray-800">
      <h1 className="text-xl font-bold">Foodie</h1>

      <div className="flex gap-6 items-center">
        {user && (
          <>
          <Link to="/" className="flex">Home</Link>
          <Link to="/cart" className="flex">Cart</Link>
          <Link to="/orders" className="flex">Orders</Link>
          <Link to="/create-restaurant" className="flex">Create Restaurant</Link>
          <Link to="/admin" className="flex">Restaurant orders</Link>

            <button
              onClick={handleLogout}
              className="bg-red-500 px-3 py-1 rounded-lg hover:opacity-80"
            >
              Logout
            </button>
          </>
        )}

        {!user && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </div>
  );
}