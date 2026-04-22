const LoadingGrid = () => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">

      {[1,2,3,4,5,6].map((i) => (
        <div
          key={i}
          className="h-64 bg-card rounded-2xl animate-pulse"
        />
      ))}

    </div>
  );
};

export default LoadingGrid;