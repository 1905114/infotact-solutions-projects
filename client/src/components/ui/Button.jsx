const Button = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) => {
  const base =
    "rounded-xl font-medium transition-all duration-200 active:scale-95";

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2.5",
    lg: "px-6 py-3 text-lg"
  };

  const variants = {
    primary:
      "bg-primary text-white hover:bg-primarySoft shadow-lg shadow-primary/20",
    secondary:
      "bg-surfaceLight text-text hover:bg-surface",
    ghost:
      "text-textMuted hover:text-white"
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;

// const Button = ({ children, variant = "primary", className = "", ...props }) => {
//   const base = "px-4 py-2 rounded-lg font-medium transition";

//   const styles = {
//     primary: "bg-primary text-white hover:opacity-90",
//     ghost: "border border-gray-600 text-muted hover:bg-gray-800"
//   };

//   return (
//     <button
//       className={`${base} ${styles[variant]} ${className}`}
//       {...props}
//     >
//       {children}
//     </button>
//   );
// };

// export default Button;