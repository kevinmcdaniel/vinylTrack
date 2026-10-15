import type { Metadata } from "next";
import { getThemeChoice } from "@/lib/themeChoice";
import { themeCss } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "vinylTrack",
  description: "Family record, album, and MP3 collection tracker",
};

// Color tokens come from lib/themes.ts (#18). The theme is chosen on the
// server from the vt_theme cookie, so there's no flash of the wrong one.
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getThemeChoice();
  return (
    <html lang="en" data-theme={theme ?? undefined}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
