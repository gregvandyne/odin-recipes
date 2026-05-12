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
        // Aeonik is the primary UI typeface; Inter (web) and the system stack
        // act as fallbacks if the licensed Aeonik files aren't present.
        sans: [
          "Aeonik",
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        serif: [
          "var(--font-serif)",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Five-step type scale. Display tightened for serif use on landing.
        caption: ["13px", { lineHeight: "1.45" }],
        body: ["16px", { lineHeight: "1.65" }],
        "body-lg": ["18px", { lineHeight: "1.65" }],
        heading: ["24px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        display: ["34px", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
      },
      fontWeight: {
        // Two weights. No exceptions.
        normal: "400",
        semibold: "600",
      },
      spacing: {
        // 8-point grid tokens, plus generous 80/112/144 for breathing-room sections
        "0.5": "0.125rem", // 2
        "1": "0.25rem",    // 4
        "2": "0.5rem",     // 8
        "3": "0.75rem",    // 12
        "4": "1rem",       // 16
        "6": "1.5rem",     // 24
        "8": "2rem",       // 32
        "12": "3rem",      // 48
        "16": "4rem",      // 64
        "20": "5rem",      // 80
        "24": "6rem",      // 96
        "28": "7rem",      // 112
        "36": "9rem",      // 144
      },
      borderRadius: {
        // Softer corners throughout — paper-letter feel.
        sm: "6px",
        DEFAULT: "10px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "28px",
      },
      boxShadow: {
        // Two-tier warm-toned shadows. Soft for resting cards, raised for hover/CTAs.
        soft:    "0 1px 2px rgba(75, 55, 30, 0.04), 0 2px 6px rgba(75, 55, 30, 0.05)",
        raised:  "0 4px 12px rgba(75, 55, 30, 0.06), 0 12px 32px rgba(75, 55, 30, 0.08)",
        warm:    "0 1px 2px rgba(120, 90, 50, 0.05), 0 4px 16px rgba(120, 90, 50, 0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms ease-out",
        "fade-up": "fade-up 360ms cubic-bezier(0.2, 0.7, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
