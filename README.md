# Bora um Tênis 🎾

O ponto de encontro dos tenistas amadores: ache partidas abertas num raio de até
70 km, combine o jogo no chat, registre o placar e suba no ranking da sua região.

App **web** feito com [Next.js 16](https://nextjs.org) (App Router) e
[Supabase](https://supabase.com).

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com as credenciais do seu projeto Supabase
npm run dev            # http://localhost:3000
```

Outros comandos:

| Comando | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm start` | roda o build |
| `npm test` | testes unitários (`node --test`) |

## Como o projeto é organizado

```
app/                     rotas (App Router)
  page.tsx               landing pública, renderizada no servidor
  entrar/  auth/callback/ login por e-mail e retorno do Google
  (app)/                 tudo que exige sessão — layout com a barra lateral
src/
  components/            vocabulário visual (ui/), galeria, compositor, mini-mapa
  lib/                   supabase, auth, fotos, privacidade, geocode, datas…
  theme/tokens.css       a identidade visual em variáveis CSS
public/                  imagens estáticas
```

Cada tela tem um CSS Module irmão (`page.tsx` + `nome.module.css`). Cores, raios
e medidas saem sempre das variáveis de `src/theme/tokens.css`.

## Identidade

"Quadra à noite": a estrutura do app é escura como um piso rápido sob refletor, o
conteúdo é claro como giz, o saibro entra só como acento e a bola de tênis aparece
uma vez por tela, no marcador da navegação. Três vozes tipográficas — Archivo nos
títulos, IBM Plex Sans no texto e IBM Plex Mono nos números (dígitos tabulares,
para placares não dançarem entre linhas).

## Privacidade

Cada pessoa escolhe, em **Editar perfil → Privacidade**, quem vê seu perfil e
quem vê suas fotos, em três níveis: todo mundo, só quem já jogou com ela, ou
ninguém.

A regra é aplicada no banco, não na interface:

- a tabela `profiles` só devolve a própria linha; o perfil dos outros vem da
  view `public.perfis`, que mascara coluna a coluna;
- as RPCs `SECURITY DEFINER` (`feed`, `ranking_*`, `comentarios_post`,
  `perfis_da_partida`) aplicam o mesmo mascaramento, já que passam por cima do RLS;
- os buckets `avatares` e `partidas` são **privados**: as fotos só saem por URL
  assinada de curta duração, emitida apenas para quem a policy autoriza;
- idade, altura e a localização exata nunca aparecem para quem nunca jogou com
  você, em nenhum dos níveis.

Uma exceção deliberada: quem pede pra entrar na sua partida mostra a você as tags
de jogo (anos jogando, mão, golpe) mesmo com o perfil fechado — sem isso não dá
pra decidir quem entra. Idade e cidade continuam guardadas.

## Deploy

Vercel, por push na branch `principal`. As variáveis `NEXT_PUBLIC_SUPABASE_URL` e
`NEXT_PUBLIC_SUPABASE_ANON_KEY` ficam no painel do projeto. A URL de produção
precisa estar na allowlist de **Redirect URLs** do Supabase para o login com o
Google funcionar.
