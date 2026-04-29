import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zeus Admin - Panel de Gestión',
  description: 'Panel de administración para Zeus Fisioterapia y Psicología',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/zeus-favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/zeus-favicon.png' }],
  },
};

import Providers from './providers';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const fontVars = {
    '--font-body': '"Segoe UI", Arial, sans-serif',
    '--font-zeus-sans': '"Segoe UI", Arial, sans-serif',
    '--font-zeus-display': 'Georgia, "Times New Roman", serif',
  } as React.CSSProperties;

  return (
    <html lang="es" suppressHydrationWarning>
      <body style={fontVars} suppressHydrationWarning>
        <Providers nonce={nonce}>
          <AuthProvider>{children}</AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
