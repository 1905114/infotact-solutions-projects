const EmptyState = () => {
  return (
 <div className="flex flex-col items-center justify-center py-24 text-center">

  <div className="text-5xl mb-4">🍜</div>

  <h2 className="text-xl font-semibold">
    No restaurants nearby
  </h2>

  <p className="text-muted mt-2">
    Try changing your location or refresh
  </p>

  <button className="mt-6 bg-primary px-5 py-2 rounded-lg">
    Retry
  </button>

</div>
  );
};

export default EmptyState;