const Card = ({ children, className = "" }) => {
  return (
    <div
      className={`bg-surface rounded-2xl border border-border 
      shadow-lg shadow-black/20 hover:shadow-xl hover:-translate-y-1 
      transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
};

export default Card;

// const Card = ({ children, className = "" }) => {
//   return (
//     <div
//       className={`bg-card rounded-2xl shadow-md hover:shadow-lg transition ${className}`}
//     >
//       {children}
//     </div>
//   );
// };

// export default Card;