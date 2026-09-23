-- ============================================================================
-- WEARABLES — a camada de dados. Strava primeiro.
-- ============================================================================
-- Até aqui a atividade era digitada na mão ou gravada pelo GPS do navegador.
-- Quem tem relógio já mede tudo isso melhor, só que o dado mora no provedor.
-- Esta migration abre o lugar onde o vínculo com esse provedor vai viver.
--
-- O QUE ESTE ARQUIVO **NÃO** FAZ, de propósito: não tem Edge Function, não
-- tem fluxo OAuth, não tem webhook. Nada disso pode ser escrito antes de o
-- `client_id`/`client_secret` do Strava existirem, e credencial não se
-- inventa. Aqui é só o schema que esse código vai encontrar pronto.
--
-- POR QUE STRAVA PRIMEIRO: praticamente todo relógio esportivo (Apple Watch,
-- Garmin, Whoop, Polar, Coros) exporta para o Strava automaticamente. Uma
-- integração só cobre indiretamente uma fatia grande dos três. Garmin e Whoop
-- ficam previstos no CHECK para quando houver credencial deles.
--
-- A REGRA QUE ORGANIZA O ARQUIVO INTEIRO: **token é segredo, e segredo não
-- passa pelo navegador.** Está escrito por extenso no bloco 4, que é onde a
-- subtarefa realmente mora — o `create table` é a parte fácil.
--
-- O arquivo inteiro é idempotente: rodar duas vezes não dá erro e não
-- duplica nada. Não há DROP TABLE, TRUNCATE nem DELETE. A única coisa
-- derrubada é um CHECK constraint, no bloco 1, para ser recriado mais largo
-- na linha seguinte — nenhuma linha de dado é tocada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. A FONTE DA ATIVIDADE GANHA 'strava' E 'whoop'
-- ----------------------------------------------------------------------------
-- ATENÇÃO, porque a documentação do projeto erra isto: `activity_sessions.fonte`
-- NÃO é enum. É `text` com um CHECK constraint chamado
-- `activity_sessions_fonte_check` (veja o `create table` em
-- 20260913_atividades.sql). Portanto o caminho é DROP + ADD do constraint, e
-- **não** `alter type ... add value`, que falharia com "type is not an enum".
--
-- É uma mudança que só ALARGA o conjunto aceito: todo valor que passava
-- antes continua passando, então o `add constraint` não pode reprovar
-- nenhuma linha existente. Por isso é seguro sem tocar em dado.
alter table public.activity_sessions
  drop constraint if exists activity_sessions_fonte_check;

alter table public.activity_sessions
  add constraint activity_sessions_fonte_check
  check (fonte in (
    'manual',          -- a pessoa digitou os horários
    'gps_web',         -- a Geolocation API do navegador gravou o trajeto
    'garmin',          -- previsto; depende de credencial que ainda não existe
    'apple_health',    -- previsto; só fala com app nativo, que não existe aqui
    'health_connect',  -- idem
    'strava',          -- o primeiro a ser ligado de verdade
    'whoop'            -- previsto; único que também dá recuperação/strain
  ));

comment on column public.activity_sessions.fonte is
  'De onde vieram os números. Hoje a web só produz manual e gps_web. strava e whoop chegam pela integração de servidor (wearable_connections); garmin, apple_health e health_connect seguem previstos no schema sem uso. É text + CHECK, não enum — para acrescentar valor, mexa no constraint activity_sessions_fonte_check.';


-- ----------------------------------------------------------------------------
-- 2. A CONEXÃO COM O PROVEDOR
-- ----------------------------------------------------------------------------
-- Uma linha por (jogador, provedor). Guarda o que o servidor precisa para
-- falar com o provedor em nome daquele jogador — e, principalmente, o mapa
-- que liga o ID DO ATLETA NO PROVEDOR ao nosso uuid.
--
-- Esse mapa é o motivo de a tabela existir. O webhook do Strava não sabe quem
-- é o nosso usuário: ele manda `owner_id`, que é o id do atleta lá. Sem
-- `(provedor, atleta_id) -> user_id` não há como resolver de quem é a
-- atividade que acabou de chegar, e o evento vira lixo.
create table if not exists public.wearable_connections (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provedor      text not null
    constraint wearable_connections_provedor_check
    check (provedor in ('strava', 'garmin', 'whoop')),
  -- text, não bigint: o Strava usa número, mas o Whoop não. Um text serve aos
  -- três sem migration nova no dia em que o segundo entrar.
  atleta_id     text not null,
  access_token  text,
  refresh_token text,
  expira_em     timestamptz,
  escopo        text,
  status        text not null default 'ativa'
    constraint wearable_connections_status_check
    check (status in ('ativa', 'expirada', 'revogada')),
  -- Quando o vínculo OAuth foi estabelecido. Separado de `created_at` porque
  -- reconectar NÃO cria linha nova (a unicidade de (user_id, provedor) impede):
  -- o servidor atualiza a linha existente e move esta data. `created_at`
  -- continua marcando o nascimento da linha.
  conectado_em  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Rede de segurança da idempotência: se a tabela já existia de uma tentativa
-- meio aplicada, o `create table if not exists` acima não teria feito nada.
-- Cada coluna é reafirmada individualmente. Mesmo padrão de
-- 20260913_atividades.sql.
alter table public.wearable_connections
  add column if not exists user_id       uuid,
  add column if not exists provedor      text,
  add column if not exists atleta_id     text,
  add column if not exists access_token  text,
  add column if not exists refresh_token text,
  add column if not exists expira_em     timestamptz,
  add column if not exists escopo        text,
  add column if not exists status        text not null default 'ativa',
  add column if not exists conectado_em  timestamptz not null default now(),
  add column if not exists created_at    timestamptz not null default now(),
  add column if not exists updated_at    timestamptz not null default now();

-- `add column if not exists` não traz CHECK junto. Se as colunas vieram por
-- ali, as restrições precisam ser recolocadas à mão. Numa criação limpa este
-- bloco não faz nada.
do $restricoes$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.wearable_connections'::regclass
       and conname = 'wearable_connections_provedor_check'
  ) then
    alter table public.wearable_connections
      add constraint wearable_connections_provedor_check
      check (provedor in ('strava', 'garmin', 'whoop'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.wearable_connections'::regclass
       and conname = 'wearable_connections_status_check'
  ) then
    alter table public.wearable_connections
      add constraint wearable_connections_status_check
      check (status in ('ativa', 'expirada', 'revogada'));
  end if;
end
$restricoes$;

-- As duas unicidades, como índice (e não como `add constraint`) porque
-- `create unique index if not exists` é idempotente de graça.
--
-- Uma conta por provedor: reconectar atualiza a linha, não empilha outra.
create unique index if not exists wearable_connections_user_provedor_idx
  on public.wearable_connections (user_id, provedor);

-- E um atleta do provedor pertence a UM usuário nosso. Esta é a unicidade que
-- protege o webhook: sem ela, duas linhas poderiam reivindicar o mesmo
-- `owner_id` do Strava e a atividade cairia na conta errada.
create unique index if not exists wearable_connections_provedor_atleta_idx
  on public.wearable_connections (provedor, atleta_id);

comment on table public.wearable_connections is
  'Vínculo OAuth de cada jogador com cada provedor de wearable. Guarda segredo: access_token e refresh_token NÃO são legíveis pelo papel authenticated (privilégio de coluna no bloco 4). Fora do Realtime de propósito.';

comment on column public.wearable_connections.atleta_id is
  'Id do atleta NO PROVEDOR (owner_id do webhook do Strava). É o mapa que resolve de quem é a atividade que chegou; sem ele o evento não tem dono.';

comment on column public.wearable_connections.access_token is
  'SEGREDO. Nunca é concedido a authenticated e nunca deve aparecer em RPC, view ou payload de Realtime. Só o servidor (service_role) lê.';

comment on column public.wearable_connections.refresh_token is
  'SEGREDO, e o mais grave dos dois: não expira sozinho. Vale o mesmo aviso do access_token.';

comment on column public.wearable_connections.status is
  'ativa = dá para chamar o provedor. expirada = o refresh falhou e o jogador precisa reconectar. revogada = o jogador (ou o provedor) desfez o vínculo; a linha sobrevive com os tokens nulos para o mapa de atleta não se perder.';

comment on column public.wearable_connections.conectado_em is
  'Quando o vínculo OAuth foi (re)estabelecido. Reconectar move esta data sem criar linha nova. É o único carimbo de data que a interface enxerga.';

-- O updated_at se mantém sozinho, com a função que o projeto já tem.
drop trigger if exists wearable_connections_updated_at on public.wearable_connections;
create trigger wearable_connections_updated_at
  before update on public.wearable_connections
  for each row execute function public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 3. RLS — cada um só alcança a própria linha
-- ----------------------------------------------------------------------------
alter table public.wearable_connections enable row level security;

-- Leitura: só a própria linha. Não existe conexão "compartilhada" — ao
-- contrário de activity_sessions, aqui não há nada que faça sentido mostrar
-- para outra pessoa, nem com opt-in.
drop policy if exists wearables_leitura on public.wearable_connections;
create policy wearables_leitura on public.wearable_connections
  for select to authenticated
  using (auth.uid() = user_id);

-- Desconectar: o jogador pode apagar a própria conexão, sempre.
drop policy if exists wearables_remocao on public.wearable_connections;
create policy wearables_remocao on public.wearable_connections
  for delete to authenticated
  using (auth.uid() = user_id);

-- NÃO EXISTE POLICY DE INSERT NEM DE UPDATE PARA `authenticated`. A ausência
-- é a decisão, não um esquecimento:
--
-- quem cria a linha é o SERVIDOR, depois do handshake OAuth, porque só ele
-- tem prova de que aquele `atleta_id` pertence mesmo a quem está pedindo. Se
-- o navegador pudesse inserir, alguém autenticado escreveria uma linha sua
-- com o `atleta_id` de OUTRA pessoa — e, como o webhook resolve o dono
-- justamente por `(provedor, atleta_id)`, as atividades da vítima passariam a
-- cair na conta do atacante. A unicidade do bloco 2 não impede isso sozinha:
-- ela só garante que UMA linha ganha a corrida, e o atacante pode chegar
-- primeiro.
--
-- Resultado prático: pela API pública dá para LER a própria conexão e APAGÁ-LA.
-- Criar e atualizar é exclusividade do service_role, que não passa por RLS.
--
-- (Apagar a linha não avisa o provedor. O "deauthorize" no Strava é chamada
-- de servidor e entra junto com o fluxo OAuth. Enquanto não existir, uma
-- conexão apagada aqui faz o webhook continuar chegando e ser descartado por
-- não ter dono — barulho, não vazamento.)


-- ----------------------------------------------------------------------------
-- 4. PRIVILÉGIO DE COLUNA — onde esta subtarefa realmente mora
-- ----------------------------------------------------------------------------
-- RLS DECIDE LINHA, NÃO COLUNA. A policy do bloco 3 está certa e é necessária,
-- mas ela só sabe dizer "esta linha é sua". Alcançada a linha, um `select *`
-- pelo PostgREST traria a linha INTEIRA — access_token e refresh_token junto.
-- E a linha É do próprio usuário, então nenhuma policy concebível barraria:
-- do ponto de vista da RLS, ele está lendo o que é dele.
--
-- Só que o token NÃO é dele para ler. É uma credencial que o nosso servidor
-- guarda em nome dele. Vazada para o navegador, ela vira uma chave da conta
-- Strava da pessoa em qualquer extensão, XSS ou aba de DevTools — e o
-- refresh_token nem expira sozinho.
--
-- Quem resolve isso é privilégio de coluna, exatamente como
-- 20260913_atividades.sql já faz com fc_media, fc_max e rota: `authenticated`
-- simplesmente NÃO RECEBE select nessas duas colunas. Quem tentar lê-las pela
-- API leva "permission denied for column", dono ou não.
--
-- O `revoke all` primeiro não é decoração: os default privileges do Supabase
-- dão ALL nas tabelas novas de `public` para anon e authenticated — inclusive
-- SELECT da tabela inteira, que furaria todo o esquema abaixo, e TRUNCATE, que
-- RLS não protege (TRUNCATE não olha linha nenhuma). `service_role` fica de
-- fora do revoke de propósito: é a chave de servidor, e é ela que escreve os
-- tokens.
revoke all on public.wearable_connections from anon, authenticated;

-- A lista é exaustiva e access_token/refresh_token estão FORA dela. Se você
-- veio acrescentar uma coluna nova na tabela, ela não entra aqui por
-- descuido — pense se a interface precisa mesmo dela antes de somar o nome.
grant select (
  id, user_id, provedor, atleta_id, expira_em, escopo, status,
  conectado_em, created_at, updated_at
) on public.wearable_connections to authenticated;

-- Desconectar. Sem insert e sem update: veja o bloco 3.
grant delete on public.wearable_connections to authenticated;


-- ----------------------------------------------------------------------------
-- 5. FORA DO REALTIME, DE PROPÓSITO
-- ----------------------------------------------------------------------------
-- O Realtime avalia a policy de LINHA, mas NÃO respeita privilégio de coluna.
-- Publicar esta tabela mandaria a linha inteira — access_token e
-- refresh_token incluídos — para todo assinante que a policy deixasse passar,
-- anulando o bloco 4 inteiro. É a mesma decisão que activity_sessions já
-- tomou, pela mesma razão.
--
-- O bloco abaixo não é só comentário: ele DESFAZ a inclusão se alguém tiver
-- adicionado a tabela à publicação pelo painel. Numa aplicação limpa não faz
-- nada, porque tabela nova não nasce publicada.
do $realtime$
begin
  if exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'wearable_connections'
  ) then
    alter publication supabase_realtime drop table public.wearable_connections;
    raise notice
      'wearable_connections removida de supabase_realtime: o Realtime ignora privilégio de coluna e entregaria os tokens.';
  end if;
end
$realtime$;


-- ----------------------------------------------------------------------------
-- 6. O QUE A INTERFACE PODE PERGUNTAR
-- ----------------------------------------------------------------------------
-- O jogador precisa saber que está conectado — e só isso. Esta função é a
-- porta: devolve provedor, desde quando, e em que estado. Nenhum token, nem
-- mascarado, nem truncado, nem "os 4 últimos dígitos": um token não tem
-- versão parcial segura, e mostrar pedaço só ensina que ele passa por aqui.
--
-- Também não devolve `atleta_id`: a tela não tem o que fazer com ele, e o
-- privilégio de coluna do bloco 4 já basta para quem precisar consultar a
-- própria linha direto.
create or replace function public.minhas_conexoes_wearable()
returns table (
  provedor     text,
  conectado_em timestamptz,
  status       text
)
language sql
stable
security definer
-- search_path fixo: numa função SECURITY DEFINER, um search_path vindo de
-- fora escolheria qual `wearable_connections` é `wearable_connections`.
-- `pg_temp` no fim pela mesma razão.
set search_path to 'public', 'pg_temp'
as $fn$
  select w.provedor,
         w.conectado_em,
         w.status
    from public.wearable_connections w
   where auth.uid() is not null
     and w.user_id = auth.uid()
   order by w.provedor;
$fn$;

comment on function public.minhas_conexoes_wearable() is
  'Conexões de wearable do próprio usuário: provedor, desde quando e em que estado. Nunca devolve token — nem parcial.';


-- ----------------------------------------------------------------------------
-- 7. GRANTS DA FUNÇÃO
-- ----------------------------------------------------------------------------
-- O `revoke` vem antes do `grant` e tira de PUBLIC — não só de `anon`.
-- O Postgres concede EXECUTE a PUBLIC em toda função nova, e `anon` é membro
-- de PUBLIC como todo mundo: revogar só de `anon` fecha a porta da frente e
-- deixa a dos fundos aberta. Este projeto já teve seis funções nessa situação.
revoke execute on function public.minhas_conexoes_wearable() from public, anon;
grant  execute on function public.minhas_conexoes_wearable() to authenticated;
