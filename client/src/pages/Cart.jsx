import { useEffect, useState } from 'react';
import API from '../api/api';

export default function Cart() {
  const [cart, setCart] = useState(null);

  const fetchCart = () => {
    API.get('/cart').then((res) => setCart(res.data));
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const placeOrder = async () => {
    await API.post('/orders');
    alert('Order placed!');
    fetchCart();
  };

  if (!cart) return <p>Empty cart</p>;

  return (
    // <div>
    //   <h2>Cart</h2>

    //   {cart.items.map((item) => (
    //     <div key={item._id}>
    //       <p>{item.menuItem.name}</p>
    //       <p>Qty: {item.quantity}</p>
    //     </div>
    //   ))}

    //   <button onClick={placeOrder}>Place Order</button>
    // </div>

    <div className="p-6 max-w-xl mx-auto">
  <h2 className="text-2xl mb-4">Cart</h2>

  {cart.items.map((item) => (
    <div className="bg-gray-900 p-4 rounded-xl mb-3 flex justify-between">
      <p>{item.menuItem.name}</p>
      <p>x{item.quantity}</p>
    </div>
  ))}

  <button
    onClick={placeOrder}
    className="w-full mt-4 bg-green-500 py-3 rounded-xl font-semibold"
  >
    Place Order
  </button>
</div>
  );
}