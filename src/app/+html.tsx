import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Shell HTML da versão web. Carrega as três vozes tipográficas (Archivo para
 * títulos, IBM Plex Sans para leitura, IBM Plex Mono para números) e pinta o
 * fundo com a cor da estrutura para não haver "flash" branco antes do bundle.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0D1714" />
        <title>Bora um Tênis</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html,body{margin:0;padding:0;background:#0D1714}
              #root{display:flex;min-height:100%}
              :focus-visible{outline:2px solid #B4472A;outline-offset:2px;border-radius:4px}
              ::selection{background:#D7F04A;color:#0F1512}
              @media (prefers-reduced-motion:reduce){
                *{animation-duration:.01ms !important;transition-duration:.01ms !important}
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
