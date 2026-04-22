import RestaurantHeader from "../components/sections/RestaurantHeader";
import MenuSection from "../components/sections/MenuSection";
import CartBar from "../components/sections/CartBar";

const RestaurantPage = () => {
  return (
    <div className="max-w-7xl mx-auto pb-24">

      <RestaurantHeader />

      <MenuSection />

      <CartBar />

    </div>
  );
};

export default RestaurantPage;