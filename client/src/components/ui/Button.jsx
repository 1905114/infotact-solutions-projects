const Button = ({ children, variant = "primary", className = "", ...props }) => {
  const base = "px-4 py-2 rounded-lg font-medium transition";

  const styles = {
    primary: "bg-primary text-white hover:opacity-90",
    ghost: "border border-gray-600 text-muted hover:bg-gray-800"
  };

  return (
    <button
      className={`${base} ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;