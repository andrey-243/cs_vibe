import type { Metadata, Viewport } from "next";
import "./globals.css";
import "flag-icons/css/flag-icons.min.css";
import BottomNav from "./components/BottomNav";

export const metadata: Metadata = {
  title: "CS Vibe",
  description: "CS2 card collection game",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="relative"
        style={{
          background: `
            radial-gradient(ellipse 90% 60% at 50% -10%, rgba(64,52,90,0.45) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 50% 110%, rgba(40,30,60,0.5) 0%, transparent 60%),
            linear-gradient(180deg, #0a0a0d 0%, #14141c 100%)
          `,
        }}
      >
        <main className="pb-20">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
