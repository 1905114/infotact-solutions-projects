import { useEffect, useState } from 'react';
import API from '../api/api';
import { useNavigate } from 'react-router-dom';

export default function Restaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/restaurants').then((res) =>
      setRestaurants(res.data)
    );
  }, []);

  return (
    // <div>
    //   <h2>Restaurants</h2>

    //   {restaurants.map((r) => (
    //     <div key={r._id} onClick={() => navigate(`/menu/${r._id}`)}>
    //       <h3>{r.name}</h3>
    //       <p>{r.cuisine}</p>
    //     </div>
    //   ))}
    // </div>
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
  {restaurants.map((r) => (
    <div
      key={r._id}
      onClick={() => navigate(`/menu/${r._id}`)}
      className="bg-gray-900 p-5 rounded-2xl cursor-pointer hover:scale-105 transition"
    >
      <h3 className="text-xl font-semibold">{r.name}</h3>
      <p className="text-gray-400">{r.cuisine}</p>
    </div>
  ))}
</div>
  );
}