import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Aurora Color Palette ──────────────────────────────
      colors: {
        aurora: {
          teal:    "#00c9a7",
          cyan:    "#22d3ee",
          blue:    "#60a5fa",
          violet:  "#818cf8",
          purple:  "#a78bfa",
          rose:    "#f472b6",
          pink:    "#fb7185",
          amber:   "#fbbf24",
        },
        ink: {
          base:    "#060b18",   // page background
          surface: "#0c1525",   // card / panel
          raised:  "#111e35",   // elevated card
          border:  "#1a2e4a",   // default border
          glow:    "#1e3a5f",   // glowing border
        },
        slate: {
          // Override defaults for aurora feel
          50:  "#f0f4ff",
          100: "#dde6ff",
          200: "#b4c6ef",
          300: "#8ea3cb",
          400: "#6b82ab",
          500: "#4f6490",
          600: "#394c74",
          700: "#273759",
          800: "#182540",
          900: "#0d1829",
          950: "#060b18",
        },
      },
      // ── Typography ────────────────────────────────────────
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Noto Sans SC",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      // ── Animations ───────────────────────────────────────
      keyframes: {
        "aurora-drift": {
          "0%, 100%": { transform: "translate(0px, 0px) scale(1)" },
          "33%":       { transform: "translate(40px, -30px) scale(1.05)" },
          "66%":       { transform: "translate(-25px, 35px) scale(0.97)" },
        },
        "fade-in-up": {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
      },
      animation: {
        "aurora-drift":   "aurora-drift 22s ease-in-out infinite",
        "aurora-drift-r": "aurora-drift 28s ease-in-out infinite reverse",
        "fade-in-up":     "fade-in-up 0.5s ease-out both",
        "shimmer":        "shimmer 2s linear infinite",
      },
      // ── Shadows ───────────────────────────────────────────
      boxShadow: {
        "aurora-teal":   "0 0 30px rgba(0,201,167,0.15), 0 0 60px rgba(0,201,167,0.05)",
        "aurora-purple": "0 0 30px rgba(167,139,250,0.15), 0 0 60px rgba(167,139,250,0.05)",
        "card":          "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
        "card-hover":    "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      },
      // ── Background sizes ──────────────────────────────────
      backgroundSize: {
        "400": "400px",
      },
    },
  },
  plugins: [],
};

export default config;
