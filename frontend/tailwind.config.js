/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2B5EA7",
          hover: "#1E4A8A",
          light: "#E8F0FA",
          subtle: "#F0F5FC",
        },
        bg: {
          DEFAULT: "#F5F7FA",
          secondary: "#FFFFFF",
          tertiary: "#EEF1F6",
          hover: "#F0F2F7",
        },
        text: {
          primary: "#1A2332",
          secondary: "#5A6B7F",
          tertiary: "#8C96A3",
          inverse: "#FFFFFF",
        },
        border: {
          DEFAULT: "#DDE3EB",
          light: "#E8ECF1",
          divider: "#F0F2F5",
        },
        state: {
          success: "#2D9B6E",
          warning: "#D4930D",
          error: "#D04848",
          info: "#2B5EA7",
        },
        tag: {
          tech: "#E8F0FA",
          "tech-text": "#2B5EA7",
          hr: "#FEF3E2",
          "hr-text": "#B8860B",
          finance: "#E8F8F0",
          "finance-text": "#2D9B6E",
          legal: "#F0ECF8",
          "legal-text": "#6B4FA2",
          general: "#F0F2F5",
          "general-text": "#5A6B7F",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Playfair Display", "serif"],
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
      fontSize: {
        xs: "11px",
        sm: "12px",
        base: "14px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "30px",
        "3xl": "36px",
      },
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0, 0, 0, 0.04)",
        md: "0 2px 8px rgba(0, 0, 0, 0.05)",
        lg: "0 4px 16px rgba(0, 0, 0, 0.08)",
        float: "0 8px 32px rgba(0, 0, 0, 0.10)",
      },
      transitionDuration: {
        fast: "150ms",
        normal: "250ms",
      },
      zIndex: {
        dropdown: 100,
        sticky: 200,
        "modal-backdrop": 300,
        modal: 400,
        toast: 500,
      },
    },
  },
  plugins: [],
};
