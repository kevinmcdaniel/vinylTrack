import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vinylTrack",
  description: "Family record, album, and MP3 collection tracker",
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
