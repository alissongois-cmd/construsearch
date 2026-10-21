import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        carbon: "#000000",
        paper: "#ffffff",
        bone: "#f0f0f0",
        mist: "#dddddd",
        ash: "#999999",
        best: "#1B5E3A",
      },
    },
  },
  plugins: [],
};
export default config;
