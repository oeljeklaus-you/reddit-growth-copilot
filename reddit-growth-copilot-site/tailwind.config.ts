import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0b1020",
        line: "rgba(255,255,255,0.08)",
        accent: "#3ddc97",
        accentBlue: "#76a7ff",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.35)",
        soft: "0 12px 40px rgba(8, 15, 30, 0.22)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["Satoshi", "Avenir Next", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
