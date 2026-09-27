import type { Config } from "tailwindcss";

/** A colour held in a CSS variable, still usable with Tailwind opacity modifiers (bg-carbon/80). */
const themed = (v: string) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Inter stands in for Galaxy Sans Text / Display (see docs/HANDOFF.md §5).
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        // Web-app semantic tokens: CSS variables in app/globals.css, set to the Galaxy palette
        // (dark by default, Galaxy light when chosen in Settings) so the app matches the home page.
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
        // Galaxy "midnight hardware gallery" palette. These roles are CSS variables so the page can
        // animate between dark, charcoal and light themes as you scroll (app/globals.css, ThemeController).
        // Dark values: tile #000, graphite #0e0e0e, panel #1d1d1f, steel #333336, keyline #282828,
        // slate #6e6e73, ash #86868b, fg #f5f5f7, link #2997ff.
        obsidian: themed("--c-tile"),
        graphite: themed("--c-graphite"),
        carbon: themed("--c-panel"),
        steel: themed("--c-steel"),
        keyline: themed("--c-keyline"),
        slate: themed("--c-slate"),
        ash: themed("--c-ash"),
        porcelain: themed("--c-fg"),
        galaxy: { DEFAULT: "#0381fe", hover: "#1a8dff" },
        link: themed("--c-link"),
        cobalt: "#0066cc",
        amber: "#d95c14",
        optical: "#00ff00",
      },
      borderRadius: {
        bubble: "26px",
        card: "26px",
        list: "20px",
        sheet: "34px",
        btn: "14px",
        badge: "8px",
        tile: "24px",
        media: "16px",
        nav: "20px",
        capsule: "36px",
      },
      boxShadow: {
        // No drop shadows (Galaxy): floating controls get a 1px keyline, set per theme in globals.css.
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
        title: ["32px", { lineHeight: "1.13", letterSpacing: "0.128px", fontWeight: "600" }],
        "card-title": ["22px", { lineHeight: "1.25", letterSpacing: "0.2px", fontWeight: "600" }],
        question: ["18px", { lineHeight: "1.35", fontWeight: "600" }],
        body: ["17px", { lineHeight: "1.45" }],
        secondary: ["15px", { lineHeight: "1.4" }],
        caption: ["13px", { lineHeight: "1.35" }],
        // Galaxy type scale
        "display-xl": ["96px", { lineHeight: "1.04", letterSpacing: "-1.44px", fontWeight: "600" }],
        display: ["80px", { lineHeight: "1.05", letterSpacing: "-1.2px", fontWeight: "600" }],
        "display-md": ["56px", { lineHeight: "1.07", letterSpacing: "-0.84px", fontWeight: "600" }],
        "display-sm": ["48px", { lineHeight: "1.08", letterSpacing: "-0.24px", fontWeight: "600" }],
        headline: ["40px", { lineHeight: "1.1", letterSpacing: "-0.12px", fontWeight: "600" }],
        "title-lg": ["32px", { lineHeight: "1.13", letterSpacing: "0.128px", fontWeight: "600" }],
        stat: ["28px", { lineHeight: "1", letterSpacing: "0.196px", fontWeight: "600" }],
        label: ["21px", { lineHeight: "1.19", letterSpacing: "0.231px", fontWeight: "600" }],
        product: ["19px", { lineHeight: "1.21", letterSpacing: "0.228px", fontWeight: "600" }],
        lead: ["17px", { lineHeight: "1.47", letterSpacing: "-0.374px" }],
        "body-sm": ["14px", { lineHeight: "1.43", letterSpacing: "-0.224px" }],
        micro: ["12px", { lineHeight: "1.33", letterSpacing: "-0.12px" }],
      },
      maxWidth: { app: "430px" },
    },
  },
  plugins: [],
};

export default config;
