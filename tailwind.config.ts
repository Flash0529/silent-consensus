import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        // Theme tokens live in app/globals.css (light + dark).
        ink: "rgb(var(--ink) / <alpha-value>)",
        "ink-2": "rgb(var(--ink-2) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        hairline: "rgb(var(--hairline) / <alpha-value>)",
        divider: "rgb(var(--divider) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        bubble: "rgb(var(--bubble) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        control: "rgb(var(--control) / <alpha-value>)",
        backdrop: "rgb(var(--backdrop) / <alpha-value>)",
        track: "rgb(var(--track) / <alpha-value>)",
        "on-ink": "rgb(var(--on-ink) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
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
        float: "var(--shadow-float)",
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
