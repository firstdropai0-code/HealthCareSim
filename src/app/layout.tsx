import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// One neutral UI face for everything. Both variables point at it so the
// `.font-display` helper and globals.css keep working; typographic hierarchy
// comes from size and weight, not from a second typeface.
const uiFont = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FirstDropAI Healthcare Simulation",
  description: "Communication-focused healthcare roleplay simulation prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={uiFont.variable}>
      <body>{children}</body>
    </html>
  );
}
