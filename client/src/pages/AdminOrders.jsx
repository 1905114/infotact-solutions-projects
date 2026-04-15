import { useEffect, useState } from 'react';
import API from '../api/api';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);

  const fetchOrders = async () => {
    try {
      const res = await API.get('/order');
      setOrders(res.data);
    } catch (err) {
      alert("Error fetching orders");
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (id, status) => {
    try {
      await API.put(`/order/${id}`, { status });
      alert(`Updated to ${status}`);
      fetchOrders(); // refresh list
    } catch (err) {
      alert(err.response?.data?.message || "Error updating");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 24, marginBottom: 20 }}>Admin Orders</h2>

      {orders.length === 0 && <p>No orders found</p>}

      {orders.map((o) => (
        <div
          key={o._id}
          style={{
            background: "#1f2937",
            padding: 15,
            marginBottom: 15,
            borderRadius: 10,
            position: "relative",
            zIndex: 1,
          }}
        >
          <p style={{ fontSize: 12, opacity: 0.6 }}>{o._id}</p>

          <p style={{ marginTop: 5 }}>
            <strong>Status:</strong> {o.status}
          </p>

          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => updateStatus(o._id, 'accepted')}
              style={btnStyle}
            >
              Accept
            </button>

            <button
              onClick={() => updateStatus(o._id, 'preparing')}
              style={btnStyle}
            >
              Preparing
            </button>

            <button
              onClick={() => updateStatus(o._id, 'out_for_delivery')}
              style={btnStyle}
            >
              Out for Delivery
            </button>

            <button
              onClick={() => updateStatus(o._id, 'delivered')}
              style={btnStyle}
            >
              Delivered
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 🔥 simple reusable button style (safe for iPad)
const btnStyle = {
  marginRight: 10,
  marginTop: 5,
  padding: "6px 10px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
};