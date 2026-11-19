import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0C2340",
        body: "#33415C",
        muted: "#64748B",
        subtle: "#94A3B8",
        line: "#DCE3EC",
        lineStrong: "#C7D2DF",
        surface: "#FFFFFF",
        bg: "#F4F7FB",
        blue: "#0070E0",
        blueHover: "#005FC2",
        bluePressed: "#00429A",
        blueTint: "#E8F1FC",
        blueDeep: "#003087",
        amber: "#F59E0B",
        amberTint: "#FFF4E0",
        success: "#067647",
        successTint: "#E7F6EE",
        warning: "#B45309",
        warningTint: "#FDF1E3",
        danger: "#B42318",
        dangerTint: "#FDECEA",
      },
    },
  },
  plugins: [],
};
export default config;
