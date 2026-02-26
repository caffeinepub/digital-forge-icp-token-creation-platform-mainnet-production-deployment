/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        success: "var(--success)",
        warning: "var(--warning)",
        // Forge-specific tokens
        forge: {
          obsidian: "var(--forge-obsidian)",
          charcoal: "var(--forge-charcoal)",
          iron: "var(--forge-iron)",
          steel: "var(--forge-steel)",
          "steel-grey": "var(--forge-steel-grey)",
          "molten-orange": "var(--forge-molten-orange)",
          amber: "var(--forge-amber)",
          ember: "var(--forge-ember)",
          gold: "var(--forge-gold)",
          glow: "var(--forge-glow)",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        mono: ['Orbitron', 'monospace'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        none: "0px",
        sharp: "2px",
        forge: "4px",
      },
      boxShadow: {
        'forge-sm': '0 0 8px oklch(0.72 0.20 42 / 0.5), 0 0 16px oklch(0.72 0.20 42 / 0.25)',
        'forge': '0 0 20px oklch(0.72 0.20 42 / 0.4), 0 0 40px oklch(0.72 0.20 42 / 0.2)',
        'forge-lg': '0 0 30px oklch(0.72 0.20 42 / 0.5), 0 0 60px oklch(0.72 0.20 42 / 0.3)',
        'forge-amber': '0 0 20px oklch(0.78 0.18 65 / 0.4), 0 0 40px oklch(0.78 0.18 65 / 0.2)',
        'forge-card': '0 4px 24px oklch(0.05 0.01 25 / 0.8)',
        'forge-inset': 'inset 0 1px 0 oklch(0.72 0.20 42 / 0.1)',
      },
      backgroundImage: {
        'forge-gradient': 'linear-gradient(135deg, oklch(0.72 0.20 42) 0%, oklch(0.65 0.22 35) 100%)',
        'forge-gradient-amber': 'linear-gradient(135deg, oklch(0.88 0.14 90) 0%, oklch(0.78 0.18 65) 50%, oklch(0.72 0.20 42) 100%)',
        'forge-card-gradient': 'linear-gradient(135deg, oklch(0.16 0.015 30) 0%, oklch(0.14 0.012 28) 100%)',
        'forge-hero': 'radial-gradient(ellipse at 20% 50%, oklch(0.72 0.20 42 / 0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, oklch(0.65 0.22 35 / 0.06) 0%, transparent 50%), oklch(0.12 0.01 30)',
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
        "molten-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "ember-float": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0.8" },
          "50%": { transform: "translateY(-12px) scale(1.1)", opacity: "1" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "0.8" },
        },
        "forge-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "molten-flow": "molten-flow 4s ease infinite",
        "ember-float": "ember-float 3s ease-in-out infinite",
        "forge-pulse": "forge-pulse 2s ease-in-out infinite",
        "spin-slow": "spin-slow 2s linear infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries"),
  ],
};
