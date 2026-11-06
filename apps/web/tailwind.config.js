/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta del informe
        vecino: { oscuro: '#115235', DEFAULT: '#1f7a4d' },
      },
    },
  },
  plugins: [],
};
