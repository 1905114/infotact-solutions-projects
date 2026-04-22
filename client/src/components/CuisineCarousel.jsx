import { useNavigate } from "react-router-dom";
import { cuisines } from "../data/cuisines";

export default function CuisineCarousel() {
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">

      <h2 className="heading-lg mb-6">
  What’s on your mind?
</h2>

      <div className="flex gap-6 overflow-x-auto no-scrollbar snap-x">

        {cuisines.map((cuisine) => (
          <div
            key={cuisine.name}
            onClick={() => navigate(`/cuisine/${cuisine.name}`)}
            className="flex-shrink-0 w-28 cursor-pointer group snap-start"
          >
            {/* IMAGE */}
            <div className="w-28 h-28 rounded-full overflow-hidden 
            shadow-md group-hover:shadow-lg transition">

              <img
                src={cuisine.image}
                alt={cuisine.name}
                className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
              />
            </div>

            {/* TEXT */}
            <p className="text-center text-sm mt-2 text-foreground group-hover:text-primary transition">
              {cuisine.name}
            </p>
          </div>
        ))}

      </div>
    </div>
  );
}