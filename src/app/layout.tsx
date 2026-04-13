import type { Metadata } from 'next';
import { Cormorant_Garamond, Manrope, Montserrat } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700', '800'],
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-zeus-sans',
  weight: ['400', '500', '600', '700', '800'],
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-zeus-display',
  weight: ['500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Zeus Admin - Panel de Gestion',
  description: 'Panel de administracion para Zeus Fisioterapia y Psicologia',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/zeus-favicon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/zeus-favicon.png' }],
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
      <body className={`${manrope.variable} ${montserrat.variable} ${cormorantGaramond.variable}`} suppressHydrationWarning>
        <Providers>
          <AuthProvider>{children}</AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

