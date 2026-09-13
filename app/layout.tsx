import type { Metadata, Viewport } from 'next';
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import { AuthProvider } from '@/lib/auth';

import './globais.css';

/**
 * As três vozes tipográficas do app. O `next/font` hospeda os arquivos junto
 * com o site (sem ida ao Google no carregamento) e expõe cada família como
 * variável CSS, que o `tokens.css` consome em `--font-display`/`body`/`mono`.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--fonte-archivo',
  display: 'swap',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--fonte-plex-sans',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--fonte-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Bora um Tênis',
  description:
    'Ache partidas de tênis amador perto de você, combine o jogo e acompanhe seu ranking.',
};

export const viewport: Viewport = {
  themeColor: '#0D1714',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
