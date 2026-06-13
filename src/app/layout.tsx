import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FirstDrop Healthcare Simulation",
  description: "Communication-focused healthcare roleplay simulation prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
