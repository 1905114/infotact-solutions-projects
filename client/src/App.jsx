import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';

import Restaurants from './pages/Restaurants';
import Menu from './pages/Menu';
import Cart from './pages/Cart';
import Orders from './pages/Orders';

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Restaurants />} />
        <Route path="/menu/:id" element={<Menu />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/orders" element={<Orders />} />
      </Routes>
    </>
  );
}

export default App;