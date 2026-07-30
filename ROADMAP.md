# ROADMAP — Bora um Tênis 🎾

**Match-making de tênis por raio de 70km**, com **ranking ELO** e **premiações virtuais (gamificação)**. MVP sem aluguel de quadra e sem pagamento de partida.

> **Estratégia de plataforma:** **primeira versão WEB** (validar rápido no navegador, sem lojas). O app mobile (iOS/Android) vem depois **a partir do mesmo código** — usamos Expo + React Native Web, então web agora e app nativo na sequência sem reescrever.

> Documento de execução — fonte única de progresso. Marcar `[x]` a cada entrega.
> **(Você)** = decisões de produto / criação de contas · **(Eu)** = implementação (Claude).

---

## Stack

| Camada | Tecnologia |
|---|---|
| App (web agora, mobile depois) | React Native + Expo (TypeScript), Expo Router, **React Native Web** |
| UI | Nativewind (Tailwind) |
| Backend | Supabase (Postgres + Auth + Realtime + Storage + Edge Functions) |
| Geolocalização | PostGIS (`ST_DWithin` para raio de 70km) |
| Push | Expo Notifications |
| Dados | TanStack Query + Supabase JS |
| Assinatura (fase 7) | RevenueCat (IAP das lojas) |
| Observabilidade | Sentry + PostHog |

---

## Fase 0 — Fundação ✅
- [x] (Eu) Inicializar repo Git + projeto Expo SDK 57 (TypeScript) + Expo Router + tema/UI base
- [x] (Eu) Home inicial com identidade do produto (`src/app/index.tsx`)
- [x] (Eu) Criar **projeto Supabase dedicado** `bora-um-tenis` (região São Paulo / sa-east-1) — base de usuários **própria**, separada do UNIVERSUS
- [x] (Eu) Client Supabase tipado (`src/lib/supabase.ts` + `database.types.ts`) + `.env`/`.env.example`
- [x] (Eu) PostGIS + migration inicial (10 tabelas + RLS + RPC `partidas_proximas` + trigger de perfil)
- [x] (Eu) Verificação: `tsc` limpo, build web OK, REST `HTTP 200` com a chave publishable
- [ ] (Você) Rodar `npm run web` e ver a home no navegador (validação visual)
- [ ] (Eu) Sentry + PostHog (observabilidade) — pendente
- [x] **Marco:** app compila para web e conecta ao backend

> **Pendências suas na Fase 0:** criar conta **Expo/EAS** (só necessária para builds mobile na Fase 7) e definir/registrar o nome do app + domínio.

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
- [ ] (Eu) Push nativo (Expo Notifications) — fica na Fase 7 mobile; hoje é in-app/Realtime
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
- [x] (Eu) Upload de fotos (`expo-image-picker` + Storage bucket `partidas`, até 6 por partida)
- [ ] (Você) Validar o fluxo no navegador: jogar → registrar → confirmar → ver no feed e no ranking
- [x] **Marco:** jogar → registrar → subir no ranking ✅

> **Nota:** o ranking oficial passou a ser por **pontos** (regra acima). A coluna `elo_rating` continua no banco, mas saiu da interface para não competir com os pontos.

## Fase 4.5 — Fotos e feed social (pegada Strava) ✅
- [x] (Eu) Tabela `posts` (tipo `resultado` | `foto`), com curtidas e comentários **por post** (`post_likes`, `post_comments`)
- [x] (Eu) RPCs `feed` (paginado, filtrável por jogador), `publicar_post`, `adicionar_fotos_post`, `remover_foto_post`, `excluir_post`, `curtir_post`, `comentar_post`, `comentarios_post`
- [x] (Eu) **Publicar fotos direto no feed** — compositor com legenda e até 6 fotos (`src/components/publicar.tsx`)
- [x] (Eu) **Fotos depois da partida**: na tela da partida, entram no post do resultado (ou viram publicação ligada à partida se o placar ainda não saiu)
- [x] (Eu) **Foto de perfil**: bucket `avatares`, troca/remoção em `/perfil` e `/editar-perfil`; avatar aparece em feed, comentários, partidas
- [x] (Eu) Galeria estilo Strava: mosaico por quantidade de fotos + lightbox com navegação (`src/components/galeria.tsx`); grade de fotos no perfil
- [x] (Eu) Storage com RLS por pasta do usuário (`{user_id}/arquivo`), buckets públicos para leitura
- [ ] (Você) Validar no navegador: publicar foto, trocar foto de perfil e subir fotos depois do jogo

## Fase 5 — Gamificação
- [ ] (Você) Definir lista inicial de badges e regras de premiação
- [ ] (Eu) Badges/troféus, temporadas e pódio; conquistas no perfil
- [ ] **Marco:** loop de engajamento completo

## Fase 6 — Polimento e Publicação WEB
- [ ] (Eu) Estados vazios, erros, acessibilidade, revisão de RLS/privacidade
- [ ] (Você) Criar conta de hospedagem (Vercel/Netlify) + domínio
- [ ] (Eu) `expo export --platform web` + deploy do site (PWA instalável)
- [ ] **Marco:** MVP **web** publicado e acessível por link

## Fase 7 — App mobile (mesmo código)
- [ ] (Você) Contas Apple Developer (US$99/ano) e Google Play (US$25 único) + assets de loja
- [ ] (Eu) Ajustes específicos de mobile (push nativo, permissões) + build EAS + submissão
- [ ] **Marco:** app publicado nas lojas (ou beta TestFlight/Internal Testing)

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
push_tokens    (user_id, expo_token, plataforma)
notifications  (id, user_id, tipo, payload_json, lida, created_at)
```

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
