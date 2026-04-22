import { BrowserRouter, Routes, Route } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import Navbar from './components/Navbar';
import Restaurants from './pages/Restaurants';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Login from './pages/Login';
import Register from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import AdminOrders from './pages/AdminOrders';
import CreateRestaurant from './pages/CreateRestaurant';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';
import Home from './pages/Home';
import CuisinePage from './pages/CuisinePage';
import { CartProvider } from './context/CartContext';
function App() {
  
  return (
    <BrowserRouter>
    {/* <CartProvider> */}
    <Navbar /> 
    {/* </CartProvider> */}
    {/* <Layout> */}
    
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminOrders />} />
        <Route path="/" element={<Home />} />
<Route path="/cuisine/:name" element={<CuisinePage />} />
        {/* <Route path="/" element={<Home />} /> */}
        {/* <Route path="/create-restaurant" element={<CreateRestaurant />} /> */}
       <Route
  path="/create-restaurant"
  element={
    // <AdminRoute>
      <CreateRestaurant />
    // </AdminRoute>
  }
/>
        {/* <Route
          path="/"
          element={
            <ProtectedRoute>
              <Restaurants />
            </ProtectedRoute>
          }
        /> */}


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
      {/* </Layout> */}
      
    </BrowserRouter>
    
  );
}

export default App;