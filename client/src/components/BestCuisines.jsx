import { useNavigate } from "react-router-dom";
import { cuisines } from "../data/cuisines";

export default function BestCuisines() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">

      {/* 🔥 SECTION HEADER */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="heading-lg mb-6">
  Best Cuisines Near You
</h2>

        <button className="text-sm text-primary font-medium hover:underline">
          Explore all
        </button>
      </div>

      {/* 🍱 GRID */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">

        {cuisines.map((cuisine) => (
          <div
            key={cuisine.name}
            onClick={() => navigate(`/cuisine/${cuisine.name}`)}
            className="relative h-40 rounded-2xl overflow-hidden cursor-pointer group"
          >

            {/* 🖼 IMAGE */}
            <img
              src={cuisine.image}
              alt={cuisine.name}
              className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
            />

            {/* 🌑 OVERLAY */}
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition" />

            {/* 🏷 TEXT */}
            <div className="absolute bottom-4 left-4">
              <p className="text-white text-lg font-semibold">
                {cuisine.name}
              </p>
            </div>

          </div>
        ))}

      </div>
    </div>
  );
}