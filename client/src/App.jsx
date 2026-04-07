import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Restaurants from './pages/Restaurants';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
   console.log("carttttt");
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Restaurants />
            </ProtectedRoute>
          }
        />

        <Route
          path="/menu/:id"
          element={
            <ProtectedRoute>
              <Menu />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;