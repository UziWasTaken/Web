/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-in': 'slideIn 0.6s ease-out forwards',
      },
      colors: {
        'primary': 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
      },
      backdropBlur: {
        'xl': '20px',
      },
    },
  },
  plugins: [],
} 