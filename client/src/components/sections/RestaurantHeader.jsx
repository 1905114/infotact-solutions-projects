const RestaurantHeader = () => {
  return (
    <div className="mb-8">

      <div className="relative h-56 rounded-2xl overflow-hidden">

        <img
          src="https://source.unsplash.com/1200x400/?restaurant"
          className="w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-black/50" />

        <div className="absolute bottom-4 left-6">
          <h1 className="text-3xl font-bold">Burger Hub</h1>
          <p className="text-sm text-gray-300">Fast Food • 2.3 km</p>
        </div>

      </div>

    </div>
  );
};

export default RestaurantHeader;