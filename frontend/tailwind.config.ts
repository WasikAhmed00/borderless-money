import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17181C",
        muted: "#5C6470",
        subtle: "#8A93A0",
        line: "#E3E6EA",
        lineStrong: "#D4D9E0",
        surface: "#FFFFFF",
        bg: "#F6F7F9",
        amber: "#F59E0B",
        amberHover: "#D97706",
        amberPressed: "#B45309",
        amberTint: "#FFF7E8",
        success: "#067647",
        warning: "#B45309",
        danger: "#B42318",
      },
    },
  },
  plugins: [],
};
export default config;
