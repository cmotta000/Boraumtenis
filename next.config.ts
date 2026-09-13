import type { NextConfig } from 'next';

/**
 * O app roda na Vercel: servidor de verdade, sem `basePath` e sem `output:
 * 'export'` (era o que o GitHub Pages exigia). Nada de configuração de imagem
 * porque as fotos vêm do Storage por URL assinada de curta duração — o
 * otimizador não teria o que cachear.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
