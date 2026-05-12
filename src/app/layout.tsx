import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/sentinel/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { ServiceWorkerRegistrar } from "@/components/sentinel/sw-register";

// Editorial serif reserved for display headings. Two weights only — keeps
// the typographic discipline of the original system.
const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: { default: "Sentinel", template: "%s · Sentinel" },
  description:
    "Veteran first-year transition support — proactive triage that points trained human responders at the veterans who need them today.",
  manifest: "/manifest.webmanifest",
  applicationName: "Sentinel",
  appleWebApp: {
    capable: true,
    title: "Sentinel",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F2E8" },
    { media: "(prefers-color-scheme: dark)", color: "#16140F" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={serif.variable}>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-canvas-card focus:px-4 focus:py-2 focus:text-body focus:font-semibold focus:text-ink-primary focus:shadow-soft focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Skip to main content
          </a>
          {children}
          <Toaster />
          <ConfirmDialogHost />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
