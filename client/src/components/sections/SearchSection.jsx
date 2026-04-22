const SearchSection = () => {
  return (
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search restaurants or food..."
          className="w-full px-5 py-3 rounded-xl bg-card border border-gray-700 focus:border-primary outline-none shadow-sm"
        />
      </div>
  );
};

export default SearchSection;