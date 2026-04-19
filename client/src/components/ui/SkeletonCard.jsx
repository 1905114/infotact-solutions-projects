const SkeletonCard = () => {
  return (
    <div className="bg-card rounded-2xl p-4 animate-pulse">
      <div className="h-40 bg-gray-700 rounded-lg mb-4"></div>
      <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-700 rounded w-1/2"></div>
    </div>
  );
};

export default SkeletonCard;