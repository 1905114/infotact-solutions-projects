const Card = ({ children, className = "" }) => {
  return (
    <div
      className={`bg-card rounded-2xl shadow-md hover:shadow-lg transition ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;