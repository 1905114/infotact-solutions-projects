import { useEffect, useState } from 'react';
import API from '../api/api';
import { useParams } from 'react-router-dom';

export default function Menu() {
  const { id } = useParams();
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    API.get(`/menu/${id}`).then((res) =>
      setMenu(res.data)
    );
  }, [id]);

  const addToCart = (itemId) => {
    API.post('/cart', {
      menuItemId: itemId,
      quantity: 1,
    });
  };

  return (
    // <div>
    //   <h2>Menu</h2>

    //   {menu.map((item) => (
    //     <div key={item._id}>
    //       <h4>{item.name}</h4>
    //       <p>₹{item.price}</p>
    //       <button onClick={() => addToCart(item._id)}>
    //         Add to Cart
    //       </button>
    //     </div>
    //   ))}
    // </div>
    <div className="p-6 grid md:grid-cols-2 gap-6">
  {menu.map((item) => (
    <div className="bg-gray-900 p-5 rounded-xl flex justify-between items-center">
      <div>
        <h4 className="text-lg">{item.name}</h4>
        <p className="text-gray-400">₹{item.price}</p>
      </div>

      <button
        onClick={() => addToCart(item._id)}
        className="bg-white text-black px-4 py-2 rounded-lg hover:opacity-80"
      >
        Add
      </button>
    </div>
  ))}
</div>
  );
}