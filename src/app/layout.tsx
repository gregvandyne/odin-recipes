import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/sentinel/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { ServiceWorkerRegistrar } from "@/components/sentinel/sw-register";

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
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
