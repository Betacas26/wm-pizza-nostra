import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pizza Nostra',
    short_name: 'Pizza Nostra',
    description: 'Gestión de restaurante Pizza Nostra',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0D1211',
    theme_color: '#0D1211',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
