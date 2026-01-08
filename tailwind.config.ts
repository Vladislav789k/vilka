import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // зелёный акцент для основных кнопок
        brand: {
          light: "#dcfce7",   // очень светло-зелёный
          DEFAULT: "#16a34a", // зелёный (типа green-600)
          dark: "#15803d",    // тёмно-зелёный
        },
        // бело-серая поверхность
        surface: {
          DEFAULT: "#ffffff", // карточки, блоки
          soft: "#f5f5f5",    // общий фон, «подложка»
        },
      },
      boxShadow: {
        "vilka-soft": "0 18px 45px rgba(15, 23, 42, 0.07)",
      },
      borderRadius: {
        "vilka-xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
