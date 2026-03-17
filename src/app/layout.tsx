import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToasterProvider } from "@/components/ui/ToasterProvider";

export const metadata: Metadata = {
  title: "ParkingOS — Sistema de Gestión de Parqueadero",
  description: "Sistema enterprise de gestión de parqueadero comercial con mapa en tiempo real, control de entradas/salidas, facturación y reportes avanzados.",
  keywords: "parqueadero, parking, gestión, sistema, enterprise",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3182ce",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        <ToasterProvider />
        {children}
      </body>
    </html>
  );
}
