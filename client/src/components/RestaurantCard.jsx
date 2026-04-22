import { useNavigate } from "react-router-dom";

export default function RestaurantCard({ r }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/menu/${r._id}`)}
      className="bg-card rounded-2xl overflow-hidden cursor-pointer 
      hover:shadow-lg hover:-translate-y-1 transition duration-300"
    >
      {/* 🖼 IMAGE */}
      <div className="h-40 bg-gray-200">
        <img
          src={r.image || "https://via.placeholder.com/300"}
          alt={r.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 📄 CONTENT */}
      <div className="p-4">
       <h3 className="heading-md">
  {r.name}
</h3>

<p className="body-sm mt-1">
  {r.cuisine}
</p>

<div className="flex items-center justify-between mt-3">
  <span className="caption">
    ⭐ 4.3
  </span>

  <span className="caption">
    25–30 mins
  </span>
</div>

{r.distance && !isNaN(r.distance) && (
  <p className="caption mt-2">
    {r.distance < 1000
      ? `${Math.round(r.distance)} m away`
      : `${(r.distance / 1000).toFixed(1)} km away`}
  </p>
)}
      </div>
    </div>
  );
}