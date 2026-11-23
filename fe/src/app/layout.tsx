import type { Metadata, Viewport } from "next";
import { getThemeChoice } from "@/lib/themeChoice";
import { THEMES, themeCss } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "vinylTrack",
  description: "Family record, album, and MP3 collection tracker",
  // iOS reads home-screen behavior from the page, not the manifest (#9).
  appleWebApp: { capable: true, title: "vinylTrack", statusBarStyle: "default" },
};

// Browser chrome follows the OS between the classic and dark themes, like the
// page does with no vt_theme cookie.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEMES.classic.palette.bg },
    { media: "(prefers-color-scheme: dark)", color: THEMES.dark.palette.bg },
  ],
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
