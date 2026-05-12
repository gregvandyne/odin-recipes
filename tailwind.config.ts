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
        // Primary accent — refined warm tone
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "#2A2520",
        },
        // Risk levels — coordinator-side ONLY, never veteran-visible
        risk: {
          green: "#3A7A4A",
          yellow: "#B08800",
          orange: "#C45A25",
          red: "#A52828",
        },
        // Crisis — distinct, used only for 988/crisis resource banners
        crisis: {
          DEFAULT: "#8B1818",
          foreground: "#FFFFFF",
        },
        border: {
          DEFAULT: "var(--border-color)",
          strong:  "var(--border-strong)",
        },
        // shadcn-aligned semantic tokens (mapped to our palette)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        ring: "hsl(var(--ring))",
        input: "hsl(var(--input))",
      },
      fontFamily: {
        // System sans for body + UI; an editorial serif for display headings.
        sans: [
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
        // Refined type scale
        caption: ["13px", { lineHeight: "1.5" }],
        body: ["16px", { lineHeight: "1.7" }],
        "body-lg": ["18px", { lineHeight: "1.7" }],
        heading: ["24px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        display: ["36px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["48px", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
      },
      spacing: {
        // 8-point grid tokens
        "0.5": "0.125rem",
        "1": "0.25rem",
        "2": "0.5rem",
        "3": "0.75rem",
        "4": "1rem",
        "5": "1.25rem",
        "6": "1.5rem",
        "8": "2rem",
        "10": "2.5rem",
        "12": "3rem",
        "16": "4rem",
        "20": "5rem",
        "24": "6rem",
        "28": "7rem",
        "32": "8rem",
        "36": "9rem",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
      },
      boxShadow: {
        soft:    "0 1px 2px rgba(50, 40, 30, 0.03), 0 2px 8px rgba(50, 40, 30, 0.04)",
        raised:  "0 4px 16px rgba(50, 40, 30, 0.06), 0 12px 40px rgba(50, 40, 30, 0.08)",
        warm:    "0 1px 3px rgba(100, 80, 50, 0.04), 0 6px 24px rgba(100, 80, 50, 0.06)",
        glow:    "0 0 40px rgba(200, 170, 120, 0.15)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 300ms ease-out",
        "fade-up": "fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "scale-in": "scale-in 400ms cubic-bezier(0.16, 1, 0.3, 1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
