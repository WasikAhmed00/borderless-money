import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1A1A18",
        muted: "#6B6B66",
        line: "#E7E5E0",
        surface: "#FFFFFF",
        bg: "#FAFAF8",
        accent: "#D97706",
        success: "#047857",
        warning: "#B45309",
        danger: "#B91C1C",
        review: "#B45309",
      },
    },
  },
  plugins: [],
};
export default config;
