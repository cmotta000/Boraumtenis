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
  /* A barra do navegador acompanha o tema: --court claro e --court escuro. */
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0d1714' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1a16' },
  ],
  width: 'device-width',
  initialScale: 1,
};

/**
 * Roda no `<head>`, de forma síncrona, antes do primeiro paint: sem ele a
 * página nasceria no tema do sistema e piscaria para o tema escolhido quando o
 * React hidratasse. Tem que ser minúsculo e não pode derrubar a página se o
 * storage estiver bloqueado (janela privada) — daí o try/catch mudo.
 * No modo "sistema" nada é gravado, então nenhum atributo é posto e a decisão
 * volta para o `@media (prefers-color-scheme)` do tokens.css.
 */
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem("bora-tema");if(t==="escuro")document.documentElement.dataset.theme="dark";else if(t==="claro")document.documentElement.dataset.theme="light"}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
