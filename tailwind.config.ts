import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: "#0B0B0C",
        "ink-2": "#3A3A3C",
        muted: "#6E6E73",
        hairline: "#E5E5EA",
        divider: "#EDEDF0",
        surface: "#FFFFFF",
        bubble: "#F2F2F3",
        "surface-2": "#F7F7F8",
        control: "#EDEDF0",
        backdrop: "#BDBDC2",
        hush: "#5B3DF5",
        peach: { DEFAULT: "#FFE3D3", ink: "#7A2E0E" },
        blue: { DEFAULT: "#DCE9FF", ink: "#0B3D91" },
        green: { DEFAULT: "#DDF3DC", ink: "#1E5B24" },
        lilac: { DEFAULT: "#EDE4FF", ink: "#4B1FA6" },
      },
      borderRadius: {
        bubble: "26px",
        card: "26px",
        list: "20px",
        sheet: "34px",
        btn: "14px",
        badge: "8px",
      },
      boxShadow: {
        float: "0 6px 24px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.05)",
      },
      spacing: {
        float: "52px",
        row: "52px",
        pill: "58px",
        composer: "56px",
        badge: "28px",
      },
      fontSize: {
        title: ["32px", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
        "card-title": ["22px", { lineHeight: "1.25", letterSpacing: "-0.01em", fontWeight: "700" }],
        question: ["18px", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["17px", { lineHeight: "1.45" }],
        secondary: ["15px", { lineHeight: "1.4" }],
        caption: ["13px", { lineHeight: "1.35" }],
      },
      maxWidth: { app: "430px" },
    },
  },
  plugins: [],
};

export default config;
