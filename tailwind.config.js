/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'droplet': 'droplet var(--duration, 8s) linear infinite',
        'ping': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        'droplet': {
          '0%': {
            transform: 'translateY(0) translateX(0)',
            opacity: '0',
          },
          '10%': {
            opacity: '0.3',
          },
          '90%': {
            opacity: '0.3',
          },
          '100%': {
            transform: 'translateY(-100vh) translateX(var(--random-x, 20px))',
            opacity: '0',
          },
        },
        'ping': {
          '75%, 100%': {
            transform: 'scale(1.5)',
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [],
} 