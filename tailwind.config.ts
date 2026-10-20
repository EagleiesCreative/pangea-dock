import type { Config } from "tailwindcss";

// Every colour is a CSS variable (RGB triplet) so light/dark is a single class swap on <html>.
const v = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: v("canvas"),
        surface: v("surface"),
        raise: v("raise"),
        line: { DEFAULT: v("line"), strong: v("line-strong") },
        fg: { DEFAULT: v("fg"), soft: v("fg-soft"), muted: v("fg-muted"), faint: v("fg-faint") },
        brand: { DEFAULT: v("brand"), soft: v("brand-soft") },
        inverse: v("inverse"),
        "on-inverse": v("on-inverse"),
        // Semantic broadcast colours — muted, not neon
        pgm: v("pgm"),
        pvw: v("pvw"),
        vid: v("vid"),
        aud: v("aud"),
        cg: v("cg"),
        med: v("med"),
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Helvetica", "Arial", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      keyframes: {
        tally: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".35" } },
      },
      animation: { tally: "tally 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
