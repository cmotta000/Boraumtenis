# Bora um Tênis

App web de tênis amador: achar partidas por raio, marcar jogo, registrar placar
e subir no ranking. **Só web** — o Expo/React Native foi removido em 12/09/2026
e não há alvo mobile no momento.

- **Stack:** Next.js 16 (App Router) + React 19, CSS Modules sobre as variáveis
  de `src/theme/tokens.css`, Supabase (Postgres + Auth + Storage + Realtime).
- **Hospedagem:** Vercel. Nada de `basePath` nem `output: 'export'`.
- **Auth:** fica no cliente (sessão no `localStorage`, PKCE). As telas de
  `app/(app)/` são todas `'use client'`; a landing é de servidor.
- **Privacidade:** quem aplica é o banco, nunca a interface. Perfil dos outros
  vem da view `public.perfis` ou de RPCs `SECURITY DEFINER` que mascaram coluna
  a coluna; as fotos moram em buckets privados e só saem por URL assinada.
  Ao mexer em qualquer leitura de perfil ou de foto, mantenha a regra no SQL.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
