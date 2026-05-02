import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        slateDeep: "#0A0A0B",
        surface: "#0D0D0F",
        navy: "#E8A030",
        emeraldStrict: "#4CAF74",
        crimson: "#C85450",
        borderSoft: "#1E1E22"
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"]
      }
    }
  },
  plugins: []
} satisfies Config;
