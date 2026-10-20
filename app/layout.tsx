import type { Metadata, Viewport } from 'next';
import './globals.css';
import SwRegister from './sw-register';

export const metadata: Metadata = { title: 'Soft Water Specialists', description: 'Field app for water diagnosis, proposals and orders', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'Soft Sell', statusBarStyle: 'black-translucent' } };
export const viewport: Viewport = { themeColor: '#0d2550', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}<SwRegister /></body>
    </html>
  );
}
