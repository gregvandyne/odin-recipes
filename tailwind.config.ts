import type { Config } from "tailwindcss";

/**
 * Design tokens implementing the Sentinel design system.
 * Calm over clinical. Trust through restraint. Color signals state, not decoration.
 */
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // Surfaces (CSS-var driven for dark-mode swap)
        canvas: {
          veteran: "var(--canvas-veteran)",
          staff:   "var(--canvas-staff)",
          card:    "var(--canvas-card)",
          banded:  "var(--canvas-banded)",
        },
        // Text
        ink: {
          primary:   "var(--ink-primary)",
          secondary: "var(--ink-secondary)",
          tertiary:  "var(--ink-tertiary)",
        },
        // Primary accent — muted slate-blue, steadiness without medical-clinical connotations
        primary: {
          DEFAULT: "#3B5B7E",
          hover: "#2F4A68",
          foreground: "#FFFFFF",
        },
        // Risk levels — coordinator-side ONLY, never veteran-visible
        risk: {
          green: "#3D7A4A",
          yellow: "#B8860B",
          orange: "#C4622D",
          red: "#A82E2E",
        },
        // Crisis — distinct, used only for 988/crisis resource banners
        crisis: {
          DEFAULT: "#8B1A1A",
          foreground: "#FFFFFF",
        },
        border: {
          DEFAULT: "var(--border-color)",
          strong:  "var(--border-strong)",
        },
        // shadcn-aligned semantic tokens (mapped to our palette)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        ring: "hsl(var(--ring))",
        input: "hsl(var(--input))",
      },
      fontFamily: {
        // System fonts only. No custom font that signals brand over substance.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Five-step type scale. Do not invent more.
        caption: ["13px", { lineHeight: "1.45" }],
        body: ["16px", { lineHeight: "1.6" }],
        "body-lg": ["18px", { lineHeight: "1.6" }],
        heading: ["22px", { lineHeight: "1.35" }],
        display: ["28px", { lineHeight: "1.3" }],
      },
      fontWeight: {
        // Two weights. No exceptions.
        normal: "400",
        semibold: "600",
      },
      spacing: {
        // 8-point grid tokens (4 included for sub-element spacing)
        "0.5": "0.125rem", // 2
        "1": "0.25rem",    // 4
        "2": "0.5rem",     // 8
        "3": "0.75rem",    // 12
        "4": "1rem",       // 16
        "6": "1.5rem",     // 24
        "8": "2rem",       // 32
        "12": "3rem",      // 48
        "16": "4rem",      // 64
        "24": "6rem",      // 96
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        // One soft shadow. Reserve for modals, command palette, message bubbles, toasts.
        soft: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
