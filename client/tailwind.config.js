/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",

      card: "hsl(var(--card))",
      primary: "hsl(var(--primary))",
      secondary: "hsl(var(--secondary))",

      muted: "hsl(var(--muted))",
      border: "hsl(var(--border))",
    },
    fontFamily : {
      Sans : ["Plus Jakarta Sans", "sans-sarif"],
    },
  },
},
  plugins: [],
};

// export default {
//   content: [
//     "./index.html",
//     "./src/**/*.{js,jsx}"
//   ],
//   theme: {
//    // tailwind.config.js
// extend: {
//   colors: {
//     bg: "#0B0F1A",        // deep dark (not gray)
//     surface: "#111827",   // cards
//     surfaceLight: "#1F2937",

//     primary: "#FF5A5F",   // modern red (Uber/Zomato vibe)
//     primarySoft: "#FF7A7F",

//     text: "#F9FAFB",
//     textMuted: "#9CA3AF",

//     border: "#1F2937",
//     success: "#22C55E",
//     warning: "#F59E0B",
//     error: "#EF4444"
//   }
// }
//   },
//   plugins: [],
// };

// export default {
//   content: [
//     "./index.html",
//     "./src/**/*.{js,jsx}"
//   ],
//   theme: {
//     extend: {
//       colors: {
//         bg: "#0f172a",
//         card: "#1e293b",
//         primary: "#ff4d4f",
//         text: "#f1f5f9",
//         muted: "#94a3b8"
//       }
//     }
//   },
//   plugins: [],
// };