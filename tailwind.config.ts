import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Primary Brand Colors
        'brand-black': '#000000',
        'brand-green': '#39FF14', // Neon green logo
        'brand-grey': '#404040', // Dark grey
        'brand-white': '#FFFFFF',
        'brand-blue': '#0066CC', // Royal blue

        // Semantic color mapping
        border: '#E0E0E0',
        input: '#FFFFFF',
        ring: '#0066CC',
        background: '#FFFFFF',
        foreground: '#000000',

        primary: {
          DEFAULT: '#0066CC', // Royal blue
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#39FF14', // Neon green
          foreground: '#000000',
        },
        accent: {
          DEFAULT: '#39FF14', // Neon green
          foreground: '#000000',
        },
        destructive: {
          DEFAULT: '#DC2626',
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#666666',
        },
        popover: {
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
        },
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#000000',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        'headline': ['var(--font-headline)', 'sans-serif'],
        'body': ['var(--font-body)', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
