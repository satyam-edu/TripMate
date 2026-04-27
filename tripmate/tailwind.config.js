/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA', // Pure Off-White
        textMain: '#111827',   // Dark Slate
        accent: '#FF6A5A',     // Sunset Coral (The Travel Vibe)
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)', // Our signature premium drop shadow
      }
    },
  },
  plugins: [],
}