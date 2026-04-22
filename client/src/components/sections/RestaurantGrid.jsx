import { useEffect, useState } from "react";
import axios from "../../api/api";
import RestaurantCard from "../RestaurantCard";
import LoadingGrid from "./LoadingGrid";
import EmptyState from "./EmptyState";

const RestaurantGrid = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("/restaurants/nearby");
        setRestaurants(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <LoadingGrid />;

  if (!restaurants.length) return <EmptyState />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">

      {restaurants.map((r) => (
        <RestaurantCard key={r._id} restaurant={r} />
      ))}

    </div>
  );
};

export default RestaurantGrid;