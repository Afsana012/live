import "./globals.css";
import { Inter } from "next/font/google";
import { getExpiryMs } from "@/lib/channels";
import { SiteHeader } from "@/app/components/SiteHeader";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata = {
  title: "Nova TV",
  description: "Watch live TV, beautifully free.",
};

export default function RootLayout({ children }) {
  const expiryMs = getExpiryMs();

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-svh bg-background text-foreground antialiased`}>
        <SiteHeader expiryMs={expiryMs} />
        <main>{children}</main>
        <Toaster theme="dark" position="bottom-right" richColors />
      </body>
    </html>
  );
}
