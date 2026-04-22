import CuisineCarousel from "../components/CuisineCarousel";
import Restaurants from "./Restaurants";
import BestCuisines from "../components/BestCuisines";

export default function Home() {
  return (
    <div>

      <CuisineCarousel />

      <Restaurants />

      <BestCuisines />

    </div>
  );
}