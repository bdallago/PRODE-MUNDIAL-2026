import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "../src/components/Providers";
import ClientNavbar from "../src/components/ClientNavbar";
import { DynamicBackground } from "../src/components/DynamicBackground";

export const metadata: Metadata = {
  title: "Prode Mundial 2026",
  description: "Prode Mundial 2026",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <DynamicBackground />
          <ClientNavbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
