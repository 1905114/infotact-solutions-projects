import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export default function AdminRoute({ children }) {
  const { user } = useContext(AuthContext);

  if (!user) return <Navigate to="/login" />;

  if (user.role !== 'admin') {
    return <Navigate to="/" />;
  }

  return children;
}