/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAFAF8",
        foreground: "#1A1A1A",
        brandGreen: {
          light: "#CEF8DC",
          DEFAULT: "#34C363",
          dark: "#0A3A1E",
        },
        brandGold: {
          DEFAULT: "#E8C46B",
          dark: "#B7933F",
        },
      },
      fontFamily: {
        heading: ["Matter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
