# ROADMAP — Bora um Tênis 🎾

**Match-making de tênis por raio de 70km**, com **ranking ELO** e **premiações virtuais (gamificação)**. MVP sem aluguel de quadra e sem pagamento de partida.

> **Estratégia de plataforma:** **só WEB** (validar rápido no navegador, sem lojas).
> Em 12/09/2026 o Expo/React Native saiu do projeto — o layout já era de site e o
> React Native tinha virado peso morto. Mobile não está no plano agora; se voltar,
> será uma decisão nova, não a continuação deste código.

> Documento de execução — fonte única de progresso. Marcar `[x]` a cada entrega.
> **(Você)** = decisões de produto / criação de contas · **(Eu)** = implementação (Claude).

---

## Stack

| Camada | Tecnologia |
|---|---|
| App (web) | Next.js 16 (App Router) + React 19, TypeScript |
| UI | CSS Modules sobre as variáveis de `src/theme/tokens.css` · ícones `lucide-react` |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) |
| Schema | Migrations versionadas em `supabase/migrations/` (desde 13/09/2026) |
| Geolocalização | PostGIS (`ST_DWithin` para raio de 70km) |
| Notificações | In-app + Supabase Realtime (push nativo saiu junto com o Expo) |
| Dados | TanStack Query + Supabase JS |
| Assinatura (fase 7) | RevenueCat (IAP das lojas) |
| Observabilidade | Sentry + PostHog |

---

## Fase 0 — Fundação ✅
- [x] (Eu) Inicializar repo Git + projeto (era Expo SDK 57; hoje Next.js 16) + tema/UI base
- [x] (Eu) Home inicial com identidade do produto (`app/page.tsx`)
- [x] (Eu) Criar **projeto Supabase dedicado** `bora-um-tenis` (região São Paulo / sa-east-1) — base de usuários **própria**, separada do UNIVERSUS
- [x] (Eu) Client Supabase tipado (`src/lib/supabase.ts` + `database.types.ts`) + `.env`/`.env.example`
- [x] (Eu) PostGIS + migration inicial (10 tabelas + RLS + RPC `partidas_proximas` + trigger de perfil)
- [x] (Eu) Verificação: `tsc` limpo, build web OK, REST `HTTP 200` com a chave publishable
- [ ] (Você) Rodar `npm run dev` e ver a home no navegador (validação visual)
- [ ] (Eu) Sentry + PostHog (observabilidade) — pendente
- [x] **Marco:** app compila para web e conecta ao backend

> **Pendências suas na Fase 0:** definir/registrar o nome do app + domínio.

## Fase 1 — Auth e Perfil
- [x] (Eu) **Landing page** completa (identidade "saibro", `src/app/index.tsx`)
- [x] (Eu) **Login/cadastro por e-mail** real via Supabase (`src/app/entrar.tsx`) + contexto de auth (`src/lib/auth.tsx`)
- [x] (Eu) **Área logada gated** com menu de abas: Início, Partidas, Ranking, Perfil (`src/app/(app)/`)
- [x] (Eu) Conta de demonstração confirmada (`demo@boraumtenis.com.br` / `borabora123`) para testes
- [x] (Eu) Perfil auto-criado no cadastro (trigger) + tela de perfil com logout real
- [ ] (Você) Ativar OAuth Google/Apple no console (opcional) e decidir se mantém confirmação de e-mail
- [~] (Eu) Onboarding completo: foto ✅, nível ✅, mão dominante ✅ — falta disponibilidade
- [ ] (Eu) Captura e persistência de localização no perfil (GEOGRAPHY) — usada em Partidas, falta salvar no perfil
- [~] **Marco:** usuário entra e vê o menu com opções ✅ (perfil completo/edição fica na sequência)

## Fase 2 — Criar e Descobrir Partidas (núcleo)
- [x] (Eu) Tela "criar partida" (local, data/hora via chips, tipo, vagas, obs) — RPC `criar_partida` (`src/app/(app)/criar-partida.tsx`)
- [x] (Eu) Busca por raio de 70km (lista ordenada por distância, com vagas restantes + pull-to-refresh); mapa fica pra depois
- [x] (Eu) Tela de detalhe da partida (`src/app/(app)/partida/[id].tsx`)
- [x] (Eu) RLS de `matches` / `match_players` (+ `match_messages`)
- [x] **Marco:** criar → ver partidas próximas funcionando ✅

## Fase 3 — Entrar, Notificações e Chat ✅
- [x] (Eu) Entrar/solicitar + confirmação do criador + status "cheia" (RPCs `solicitar_entrada`, `responder_solicitacao`, `sair_partida`, `cancelar_partida`)
- [x] (Eu) Notificações **in-app** + Realtime (sino com badge no Início, tela `notificacoes.tsx`)
- [x] (Eu) Chat da partida (Supabase Realtime, tabela `match_messages`)
- [ ] (Eu) Push no navegador (Web Push) — hoje as notificações são in-app/Realtime
- [x] **Marco:** dois jogadores marcam e combinam ponta a ponta ✅

### Refinamento da Fase 3
**Localização** (`src/lib/location.ts`)
- [x] Origem da busca em cascata: **GPS → ponto salvo no perfil → São Paulo (aproximado)**, com rótulo na tela dizendo de onde veio
- [x] GPS não é mais pedido a cada carregamento — só quando o usuário toca em "usar minha localização exata"
- [x] Todo GPS capturado é salvo no perfil (`definir_minha_localizacao`), então a próxima visita já funciona sem permissão
- [x] Cidade/UF agora também são resolvidas **na web** (Nominatim), onde o geocoder do sistema não existe
- [x] Busca com **filtro de raio** (10 / 25 / 50 / 70 km) e "só com vaga"
- [x] `partidas_proximas` devolve nome do anfitrião e meu vínculo com a partida (criador / confirmado / aguardando)

**Notificações**
- [x] Payload enriquecido no banco: quem originou (nome) e o local/horário da partida — os textos deixaram de ser genéricos
- [x] Novos tipos: **mensagem no chat**, **lembrete 24h antes**, **cobrança de placar**, resultado registrado/confirmado/contestado, curtida e comentário
- [x] Agrupamento anti-spam: 20 mensagens no chat = 1 notificação até você ler
- [x] Lista agrupada por dia (Hoje / Ontem / Esta semana), marca lida ao abrir a notificação + "marcar todas"
- [x] Rotina automática horária via **pg_cron** (`rotina_lembretes`): lembra da partida e cobra o placar de jogos sem resultado

## Fase 4 — Resultados, Pontos e Feed ✅
**Regra de pontuação (produto):** vitória por **2 sets a 0 = 50 pts** · **2 a 1 = 35 pts** · **derrota = 0 pts**

- [x] (Eu) Registrar placar (`/resultado/[id]`): quem venceu, sets, prévia dos pontos ao vivo
- [x] (Eu) Confirmação do adversário — os pontos só entram no ranking depois de confirmado; quem registrou não confirma sozinho
- [x] (Eu) Contestação: placar contestado volta para ser refeito
- [x] (Eu) Validação server-side do placar (2 ou 3 sets, vencedor com exatamente 2, sem set empatado)
- [x] (Eu) Pontos aplicados em `rankings` (temporada, criada sozinha) + totais no perfil
- [x] (Eu) Tela de ranking por **pontos**, com abas Temporada / Geral
- [x] (Eu) **Feed social (estilo Strava, de tênis)**: cada resultado confirmado vira post com placar, pontos, legenda e **fotos**; curtir e comentar
- [x] (Eu) Upload de fotos (seletor de arquivos do navegador + Storage bucket `partidas`, até 6 por partida)
- [ ] (Você) Validar o fluxo no navegador: jogar → registrar → confirmar → ver no feed e no ranking
- [x] **Marco:** jogar → registrar → subir no ranking ✅

> **Nota (revista em 13/09/2026):** o ranking oficial continua sendo por
> **pontos**, mas o `elo_rating` deixou de ser enfeite — ele agora é calculado
> a cada jogo e é o que define o **peso** de cada vitória (ver Fase 5). O ELO
> aparece na tela da Liga como número de referência; quem disputa posição
> continua disputando por pontos, então os dois não competem.

## Fase 4.5 — Fotos e feed social (pegada Strava) ✅
- [x] (Eu) Tabela `posts` (tipo `resultado` | `foto`), com curtidas e comentários **por post** (`post_likes`, `post_comments`)
- [x] (Eu) RPCs `feed` (paginado, filtrável por jogador), `publicar_post`, `adicionar_fotos_post`, `remover_foto_post`, `excluir_post`, `curtir_post`, `comentar_post`, `comentarios_post`
- [x] (Eu) **Publicar fotos direto no feed** — compositor com legenda e até 6 fotos (`src/components/publicar.tsx`)
- [x] (Eu) **Fotos depois da partida**: na tela da partida, entram no post do resultado (ou viram publicação ligada à partida se o placar ainda não saiu)
- [x] (Eu) **Foto de perfil**: bucket `avatares`, troca/remoção em `/perfil` e `/editar-perfil`; avatar aparece em feed, comentários, partidas
- [x] (Eu) Galeria estilo Strava: mosaico por quantidade de fotos + lightbox com navegação (`src/components/galeria.tsx`); grade de fotos no perfil
- [x] (Eu) Storage com RLS por pasta do usuário (`{user_id}/arquivo`), buckets públicos para leitura
- [ ] (Você) Validar no navegador: publicar foto, trocar foto de perfil e subir fotos depois do jogo

## Fase 5 — Gamificação: a **Liga** ✅ (13/09/2026)
O ranking virou liga. A lista única e anual virou cinco divisões com temporada
trimestral, e a vitória deixou de valer sempre o mesmo.

- [x] (Eu) **Cinco divisões** (`divisions`): Saibro → Quadra Rápida → Grama →
      Quadra Central → Mestres. Nomes de superfície de quadra, não de metal.
- [x] (Eu) **Temporada trimestral** — era anual. Um ano é longo demais: quem
      chega em agosto já chega perdendo. `temporada_atual()` recorta por
      trimestre e a anual de 2026 foi aposentada **sem perder os pontos**.
- [x] (Eu) **Pontos ponderados pela força do adversário.** A base continua
      50/35 (está escrito na tela), multiplicada por um fator de ELO limitado
      a 0.6x–1.6x: ganhar de quem é 400 acima vale 80 pts, de quem é 400
      abaixo vale 30. Sem isso, a estratégia ótima seria caçar iniciante.
- [x] (Eu) **ELO de verdade** — a coluna `elo_rating` existia como enfeite
      desde a Fase 0. Agora se move a cada jogo (K=32 abaixo de 10 partidas,
      24 depois), com piso de 100 e média do time em duplas.
- [x] (Eu) **Promoção e rebaixamento** (`rotina_temporada()`): 20% sobem, 20%
      descem, mínimo de 3 jogos para se mexer. Agendada no pg_cron às 06:00
      UTC. Carry-over de 25% dos pontos na virada.
- [x] (Eu) **Tela `/liga`**: cartão da divisão, posição, barra de progresso,
      tendência, leaderboard com as zonas marcadas e espiada nas outras
      divisões. A aba "Ranking" do menu virou "Liga"; `/ranking` continua de pé
      para quem tiver o link salvo.
- [ ] (Você) Definir lista inicial de badges e regras de premiação
- [ ] (Eu) Badges/troféus e pódio no perfil (as tabelas `badges`/`user_badges`
      existem e estão vazias)
- [x] **Marco:** o jogador vê sua divisão, sua posição e o que falta pra subir
      sem abrir outra tela ✅

## Fase 6 — Polimento e Publicação WEB
- [x] (Eu) **O build estava quebrado e ninguém tinha notado** (13/09/2026): a
      pasta `src/app/` (Expo Router morto) continuava sendo type-checada e
      derrubava `next build` — o projeto não subiria na Vercel. Os restos do
      Expo foram para `local/expo-removido/` (recuperável, fora do git) e o
      `tsconfig.json` passou a excluir `local/`.
- [x] (Eu) **Tema claro/escuro** (13/09/2026): não existia nenhum. Os tokens
      ganharam paleta escura completa, com seletor Claro/Escuro/Sistema no
      perfil e script anti-flash no `<head>`. O tema claro ficou idêntico ao
      que já era — a identidade não mudou, só ganhou um irmão.
- [x] (Eu) Cores que estavam fora do sistema (26 `#fff` e 18 `rgba()` soltos)
      viraram token. Sem isso o tema escuro não teria como funcionar.
- [x] (Eu) Contraste conferido nos dois temas: todos os pares de texto
      principais em 4.5:1 ou melhor.
- [x] (Eu) `npm run lint` estava quebrado desde o Next 16 (que removeu
      `next lint`) — virou `npm run typecheck`. Lint de regras ainda não existe.
- [ ] (Eu) Estados vazios, erros, acessibilidade
- [ ] (Eu) Escala de espaçamento tokenizada (hoje há ~859 valores em px
      espalhados pelos CSS Modules). Deixado de fora por ser churn grande com
      risco de regressão visual e retorno baixo.
- [x] (Eu) Revisão de RLS/privacidade — perfis e fotos com três níveis de
      visibilidade, `profiles` fechado à própria linha, view `perfis` mascarada,
      buckets privados com URL assinada (12/09/2026)
- [ ] (Você) Criar conta na **Vercel** + apontar domínio
- [ ] (Eu) Deploy na Vercel por push (o workflow do GitHub Pages foi removido)
- [ ] **Marco:** MVP **web** publicado e acessível por link

## Fase 7 — App mobile
> Fora do plano. O Expo/React Native foi removido em 12/09/2026; um app nativo
> seria um projeto novo, decidido do zero.
>
> **O que essa decisão custa, para ficar registrado:** HealthKit (Apple) e
> Health Connect (Android) só existem para app nativo. Enquanto o alvo for
> web, a integração com wearable se limita ao que roda no navegador — GPS pela
> Geolocation API e, quando houver credencial, Garmin por OAuth de servidor
> (esse funciona sem app nativo, porque os dados vêm por webhook, não do
> aparelho).

## Fase 8 — Premium (pós-MVP)
- [ ] (Você) Definir limites do free e benefícios/preço do Premium
- [ ] (Eu) Integração RevenueCat + paywall + gate de features
- [ ] **Marco:** primeira assinatura processada

---

## Modelo de dados (núcleo)

```
profiles       (id=auth.uid, nome, avatar_url, bio, cidade, uf,
                location GEOGRAPHY(Point), skill_level, elo_rating DEFAULT 1200,
                mao_dominante, idade, altura_cm, anos_jogando, golpe_preferido,
                pontos, vitorias, derrotas, disponibilidade JSONB, created_at)
matches        (id, criador_id, tipo[simples|duplas], local_texto,
                location GEOGRAPHY(Point), data_hora, nivel_min, nivel_max,
                vagas_total, status[aberta|cheia|jogada|cancelada], observacoes, created_at)
match_players  (match_id, user_id, status[convidado|confirmado|recusado])
match_results  (id, match_id, reporter_id, vencedores uuid[], perdedores uuid[],
                sets JSONB [{v,p}], sets_vencedor, sets_perdedor, pontos[0|35|50],
                legenda, fotos text[], confirmado_por, confirmado_em,
                status[pendente|confirmado|contestado], created_at)
result_likes   (result_id, user_id, created_at)
result_comments(id, result_id, user_id, texto, created_at)
seasons        (id, nome, inicio, fim, ativa)
rankings       (season_id, user_id, pontos, vitorias, derrotas, posicao)
badges         (id, slug, nome, descricao, icone, regra)
user_badges    (user_id, badge_id, conquistado_em)
push_tokens    (user_id, expo_token, plataforma)   -- resquício do mobile; sem uso hoje
notifications  (id, user_id, tipo, payload_json, lida, created_at)

-- Liga (13/09/2026)
divisions      (id=ordem 1..5, slug, nome, apelido, cor)
seasons        (+ fechada)            -- trimestral; `fechada` = já apurada
rankings       (+ division_id, jogos, elo_inicio,
                pontos_anteriores, posicao_anterior)

-- Atividades / tracking (13/09/2026)
activity_sessions (id, user_id, match_id?, fonte[manual|gps_web|garmin|
                apple_health|health_connect], inicio, fim, duracao_s,
                distancia_m, calorias, fc_media, fc_max,
                esforco[leve|moderado|intenso], rota GEOGRAPHY(LineString),
                compartilhar_no_feed DEFAULT false, created_at)
```

**Pontuação da liga (aplicada em `confirmar_resultado`):**
```
base        2 sets a 0 → 50 pts · 2 a 1 → 35 pts · derrota → 0
fator       1 + (elo_adversario - elo_meu) / 400, limitado a [0.6, 1.6]
pontos      round(base × fator)
elo         K × (resultado - esperado), K = 32 (<10 jogos) ou 24
```

**Privacidade de dado de saúde (`activity_sessions`):** três camadas, porque
RLS filtra linha e não coluna. (1) a policy só deixa terceiro alcançar a linha
se o dono marcou `compartilhar_no_feed` **e** `pode_ver_perfil()` disser sim;
(2) `authenticated` não recebe `SELECT` nas colunas `fc_media`, `fc_max` e
`rota` — ler direto pela API dá *permission denied*; (3) `atividades_do_perfil()`
zera a FC de terceiros e nunca devolve o trajeto. A tabela **não** entra na
publicação do Realtime: `postgres_changes` respeita policy de linha, mas ignora
privilégio de coluna.

**Regra de pontos (aplicada em `confirmar_resultado`):**
```
sets 2 × 0  → vencedor +50 pts
sets 2 × 1  → vencedor +35 pts
derrota     → 0 pts (conta só como derrota no V–D)
```

**Consulta-chave (raio 70km):**
```sql
SELECT m.*, ST_Distance(m.location, :user_location) AS distancia_m
FROM matches m
WHERE m.status = 'aberta' AND m.data_hora > now()
  AND ST_DWithin(m.location, :user_location, 70000)
ORDER BY distancia_m;
```

---

## Schema do banco

Até 12/09/2026 o schema existia **só no painel do Supabase** — não havia um
único arquivo `.sql` no repositório, e a única pista local do formato das
tabelas era o `src/lib/database.types.ts` (gerado). Quem comprasse o projeto
receberia um banco sem história.

Desde 13/09/2026 toda mudança de schema vira arquivo em `supabase/migrations/`:

| Arquivo | O que faz |
|---|---|
| `20260913_liga.sql` | Divisões, temporada trimestral, ELO, pontos ponderados, promoção/rebaixamento |
| `20260913_atividades.sql` | `activity_sessions`, classificação de esforço e as RPCs de tracking |

Os dois já foram aplicados no projeto `bora-um-tenis` e são **idempotentes** —
rodar de novo não quebra nem duplica nada. O schema anterior a essa data ainda
não foi extraído para arquivo; é a dívida conhecida aqui.

> **Armadilha que já nos pegou:** o Postgres concede `EXECUTE` a `PUBLIC` em
> toda função nova. `revoke execute ... from anon` **não** fecha nada — o
> anônimo continua entrando pela porta do `PUBLIC`. O certo é
> `revoke execute ... from public, anon` e só então `grant ... to authenticated`.

## Como trabalhamos
1. Uma fase por vez, na ordem acima.
2. Ao fim de cada fase: rodar a **verificação** e revisar antes de avançar.
3. Itens **(Você)** são pré-requisitos externos — aviso quando forem bloqueantes.
4. Este `ROADMAP.md` é atualizado a cada entrega.

## Riscos
- **Efeito de rede local:** lançar focado em 1 cidade/clube primeiro (seed + parceria com academia).
- **Nível auto-declarado:** ELO corrige com o tempo (calibração inicial com K maior).
- **Privacidade:** nunca expor coordenada exata de outro usuário; usar distância aproximada.
- **IAP:** confirmar regras das lojas antes da fase 7.
