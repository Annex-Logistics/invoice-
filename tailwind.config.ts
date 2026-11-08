import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#eef6ff",
          100: "#d9ebff",
          200: "#bcdcff",
          300: "#8ec5ff",
          400: "#58a5ff",
          500: "#2f85ff",
          600: "#1866ea",
          700: "#1450c2",
          800: "#15449a",
          900: "#163b7a",
          950: "#0f254d",
        },
        ink: {
          50:  "#f6f7f9",
          100: "#eceef2",
          200: "#d5d9e0",
          300: "#b0b7c3",
          400: "#838ea0",
          500: "#636e82",
          600: "#4e5768",
          700: "#404654",
          800: "#373c47",
          900: "#1f232c",
          950: "#0e1117",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.05), 0 1px 3px rgba(16,24,40,0.06)",
        pop:  "0 10px 25px -5px rgba(16,24,40,0.1), 0 8px 10px -6px rgba(16,24,40,0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
