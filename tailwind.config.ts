import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "ui-sans-serif", "system-ui"],
      },
      colors: {
        ivory: "#f7f3ea",
        paper: "#fffdf8",
        emerald: "#0f5b46",
        sage: "#8a9b77",
        olive: "#697a4f",
        charcoal: "#26231f",
        warm: {
          50: "#fbf8f1",
          100: "#eee7da",
          200: "#ded3c3",
          300: "#c7b8a6",
          400: "#a99884",
          500: "#837567",
        },
      },
      boxShadow: {
        soft: "0 14px 40px rgba(38, 35, 31, 0.06)",
        lift: "0 10px 24px rgba(15, 91, 70, 0.10)",
      },
      borderRadius: {
        card: "20px",
        control: "14px",
      },
    },
  },
  plugins: [],
} satisfies Config;
