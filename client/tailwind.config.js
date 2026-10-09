/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#140D17',      // auditorium dark
        velvet: '#221424',   // raised surfaces
        wine: '#4A1B34',     // curtain
        brass: '#D2A857',    // the one accent: held seats, primary actions
        paper: '#F1E8D4',    // ticket stock
        stub: '#2B2118',     // ink on paper
        mist: '#A596A9',     // secondary text
      },
      fontFamily: {
        display: ['"Big Shoulders Display"', 'Impact', 'sans-serif'],
        body: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'seat-pop': {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(210,168,87,.9)' },
          '40%': { transform: 'scale(1.28)', boxShadow: '0 0 0 8px rgba(210,168,87,0)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(210,168,87,0)' },
        },
        'toast-in': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        'sheet-in': { from: { opacity: 0, transform: 'translateY(24px)' }, to: { opacity: 1, transform: 'none' } },
        'beam': { '0%,100%': { opacity: 0.55 }, '50%': { opacity: 0.8 } },
      },
      animation: {
        'seat-pop': 'seat-pop .8s ease-out',
        'toast-in': 'toast-in .25s ease-out',
        'sheet-in': 'sheet-in .3s ease-out',
        'beam': 'beam 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
