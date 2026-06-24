/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper:       "#F2EFE6",
        paperRaised: "#FAF8F1",
        ink:         "#1A1A18",
        inkMuted:    "#6B6858",
        rule:        "#D9D4C4",
        signal:      "#B3241E",
        signalSoft:  "#E8D9D7",
        field:       "#3B6D11",
        // Material 3 Expressive Tokens
        m3Canvas:    "var(--m3-canvas)",
        m3Surface:   "var(--m3-surface)",
        m3Text:      "var(--m3-text)",
        m3TextMuted: "var(--m3-text-muted)",
        m3Border:    "var(--m3-border)",
        m3Indicator: "#E8DEF8",
        m3Primary:   "#6750A4",
      },
      fontFamily: {
        mono: ["IBM Plex Mono", "monospace"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
