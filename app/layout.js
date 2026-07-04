import "./globals.css";
import { Inter } from "next/font/google";
import { getExpiryMs } from "@/lib/channels";
import { SiteHeader } from "@/app/components/SiteHeader";
import { SiteFooter } from "@/app/components/SiteFooter";
import { BottomNav } from "@/app/components/BottomNav";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Nova TV",
  description: "Watch live TV, beautifully free.",
  manifest: "/manifest.json",
  themeColor: "#34d399",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nova TV",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
};

export default function RootLayout({ children }) {
  const expiryMs = getExpiryMs();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-svh bg-background text-foreground antialiased`}>
        <SiteHeader expiryMs={expiryMs} />
        <main className="pb-16 sm:pb-0">{children}</main>
        <SiteFooter />
        <BottomNav />
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
