import type { Metadata } from 'next';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zeus Admin — Panel de Gestión',
  description: 'Panel de administración para Zeus Fisioterapia y Psicología',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [
      { url: '/img/zeus-favicon.png' },
    ],
  },
};

import Providers from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>
          <AuthProvider>{children}</AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
