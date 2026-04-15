import { useEffect, useState } from 'react';
import API from '../api/api';
import socket from '../socket/socket';
import { statusMap } from '../utils/statusMap'

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const status = statusMap;
  const fetchOrders = () => {
    API.get('/order').then((res) =>
      setOrders(res.data)
    );
  };

  useEffect(() => {
    fetchOrders();

    socket.on('orderUpdated', () => {
      fetchOrders(); // refresh on update
    });

    return () => {
      socket.off('orderUpdated');
    };
  }, []);

  return (
    // <div>
    //   <h2>My Orders</h2>

    //   {orders.map((o) => (
    //     <div key={o._id}>
    //       <p>Status: {o.status}</p>
    //     </div>
    //   ))}
    // </div>

    <div className="p-6 max-w-xl mx-auto">
  <h2 className="text-2xl mb-4">My Orders</h2>

  {orders.map((o) => (
    <div className="bg-gray-900 p-4 rounded-xl mb-3">
      <p className="font-semibold">Order ID: {o._id}</p>

      <p
        className={`mt-2 ${
          o.status === 'delivered'
            ? 'text-green-400'
            : o.status === 'preparing'
            ? 'text-yellow-400'
            : 'text-gray-400'
        }`}
      >
        {o.status}
      </p>
    </div>
  ))}
</div>

  );
}