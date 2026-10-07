import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        truco: {
          felt: '#1b4d3e', // Paño verde de mesa de truco
          feltDark: '#12352b',
          feltLight: '#266351',
          gold: '#eab308',
          wood: '#5c3a21',
          woodDark: '#3e2413',
          card: '#fefefe',
          cardBorder: '#d4af37',
        },
      },
      boxShadow: {
        card: '0 4px 12px rgba(0, 0, 0, 0.35)',
        felt: 'inset 0 0 100px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
