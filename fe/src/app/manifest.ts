import type { MetadataRoute } from 'next';
import { THEMES } from '@/lib/themes';

/**
 * Install as an app (#9). Opens on the want list — the screen you reach for in
 * a store — and full-screen. Icons are drawn by scripts/make-icons.py.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { bg } = THEMES.classic.palette;
  return {
    name: 'vinylTrack',
    short_name: 'vinylTrack',
    description: 'Family record, album, and MP3 collection tracker',
    start_url: '/wants',
    scope: '/',
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
