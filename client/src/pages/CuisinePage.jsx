import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import API from "../api/api";
import RestaurantCard from "../components/RestaurantCard";

export default function CuisinePage() {
  const { name } = useParams();
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    API.get(`/restaurants?cuisine=${name}`)
      .then((res) => setRestaurants(res.data))
      .catch(console.error);
  }, [name]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">

      <h1 className="text-2xl font-semibold mb-6">
        {name} Restaurants
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {restaurants.map((r) => (
          <RestaurantCard key={r._id} r={r} />
        ))}
      </div>

    </div>
  );
}