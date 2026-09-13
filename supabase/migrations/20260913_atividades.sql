-- ============================================================================
-- ATIVIDADES — tracking de treino, o pedaço que a web alcança
-- ============================================================================
-- O jogador amador não mede nada. Ele joga duas horas no sábado, sai molhado
-- e no domingo não lembra se foi mais ou menos que na semana passada. Quem
-- corre tem Strava para isso; quem joga tênis não tem nada.
--
-- Esta migration abre a caixa: cada sessão de jogo ou treino vira uma linha
-- com quanto tempo durou, quanto se andou dentro da quadra, e o quão puxado
-- foi. Com o tempo isso vira uma série histórica — e série histórica é o que
-- faz alguém abrir o app numa terça sem ter partida marcada.
--
-- O QUE FICOU DE FORA, DE PROPÓSITO: HealthKit (Apple) e Health Connect
-- (Android) só falam com app nativo instalado. O projeto é web desde
-- 12/09/2026 e não há alvo mobile. Os valores ficam previstos no CHECK de
-- `fonte` para o dia em que houver app, mas nada neste arquivo os alimenta.
-- O que a web entrega hoje é 'manual' (o jogador digita) e 'gps_web' (a
-- Geolocation API do navegador grava o trajeto).
--
-- PRIVACIDADE — leia antes de mexer em qualquer coisa aqui. Isto é dado de
-- saúde, não é placar. A regra da casa (privacidade mora no banco, nunca na
-- tela) vale em dobro:
--
--   • a sessão nasce PRIVADA. `compartilhar_no_feed` é opt-in explícito, com
--     default false. Não existe "compartilhar por padrão";
--   • mesmo compartilhada, a frequência cardíaca NUNCA sai para terceiro;
--   • o trajeto (`rota`) também não sai: um GPS de treino desenha a rotina
--     de uma pessoa e frequentemente começa na porta da casa dela.
--
-- O arquivo inteiro é idempotente: rodar duas vezes não dá erro e não
-- duplica nada. Só acrescenta — não há DROP TABLE, TRUNCATE nem DELETE.
-- ============================================================================


-- O PostGIS pode estar instalado em `public` (projetos mais antigos) ou em
-- `extensions` (padrão atual do Supabase). Como não dá para saber daqui qual
-- é o caso deste projeto, as duas entram no caminho enquanto a migration
-- roda, para o tipo `geography` e as funções ST_* serem encontradas nos dois
-- cenários. `public` continua na frente, então nada mais muda de resolução.
set search_path to public, extensions;

do $postgis$
begin
  if to_regtype('geography') is null then
    raise exception
      'PostGIS não está visível (nem em public, nem em extensions). As partidas já usam geography — confira a instalação da extensão antes de aplicar esta migration.';
  end if;
end
$postgis$;


-- ----------------------------------------------------------------------------
-- 1. A SESSÃO DE ATIVIDADE
-- ----------------------------------------------------------------------------
-- Uma linha por treino ou jogo. O vínculo com `matches` é OPCIONAL de
-- propósito: boa parte do que o jogador faz (parede, saque sozinho, aula com
-- o professor) não é partida nenhuma, e exigir uma partida para registrar
-- atividade mataria justamente o uso de dia de semana.
--
-- Quase toda coluna de medição é anulável porque a maioria das pessoas não
-- tem relógio: o caso comum é alguém que abre o app depois do jogo e diz
-- "joguei das 9 às 11". Um schema que exigisse distância e batimento só
-- serviria para os poucos que têm wearable.
create table if not exists public.activity_sessions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  match_id             uuid references public.matches(id) on delete set null,
  fonte                text not null
    constraint activity_sessions_fonte_check
    check (fonte in ('manual', 'gps_web', 'garmin', 'apple_health', 'health_connect')),
  inicio               timestamptz not null,
  fim                  timestamptz,
  duracao_s            int,
  distancia_m          int,
  calorias             int,
  fc_media             smallint,
  fc_max               smallint,
  esforco              text
    constraint activity_sessions_esforco_check
    check (esforco in ('leve', 'moderado', 'intenso')),
  rota                 geography(LineString, 4326),
  compartilhar_no_feed boolean not null default false,
  created_at           timestamptz not null default now()
);

-- Rede de segurança da idempotência: se a tabela já existia de uma tentativa
-- anterior meio aplicada, o `create table if not exists` acima não teria
-- feito nada. Cada coluna é reafirmada individualmente.
alter table public.activity_sessions
  add column if not exists user_id              uuid,
  add column if not exists match_id             uuid,
  add column if not exists fonte                text,
  add column if not exists inicio               timestamptz,
  add column if not exists fim                  timestamptz,
  add column if not exists duracao_s            int,
  add column if not exists distancia_m          int,
  add column if not exists calorias             int,
  add column if not exists fc_media             smallint,
  add column if not exists fc_max               smallint,
  add column if not exists esforco              text,
  add column if not exists rota                 geography(LineString, 4326),
  add column if not exists compartilhar_no_feed boolean not null default false,
  add column if not exists created_at           timestamptz not null default now();

-- `add column if not exists` não traz CHECK junto. Se as colunas vieram por
-- ali (tabela pré-existente), as restrições precisam ser recolocadas à mão.
-- Os nomes batem com os do `create table` acima, então numa criação limpa
-- este bloco não faz nada.
do $restricoes$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activity_sessions'::regclass
       and conname = 'activity_sessions_fonte_check'
  ) then
    alter table public.activity_sessions
      add constraint activity_sessions_fonte_check
      check (fonte in ('manual', 'gps_web', 'garmin', 'apple_health', 'health_connect'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.activity_sessions'::regclass
       and conname = 'activity_sessions_esforco_check'
  ) then
    alter table public.activity_sessions
      add constraint activity_sessions_esforco_check
      check (esforco in ('leve', 'moderado', 'intenso'));
  end if;
end
$restricoes$;

comment on table public.activity_sessions is
  'Sessões de treino/jogo do usuário. Dado de saúde: nasce privada (compartilhar_no_feed = false) e a frequência cardíaca nunca sai para terceiros.';

comment on column public.activity_sessions.fonte is
  'De onde vieram os números. Hoje a web só produz manual e gps_web; garmin, apple_health e health_connect estão previstos no schema mas NÃO têm uso hoje — exigem app nativo, que não existe neste projeto.';

comment on column public.activity_sessions.match_id is
  'Partida correspondente, quando houver. Opcional: treino solo, parede e aula também contam como atividade.';

comment on column public.activity_sessions.fc_media is
  'Frequência cardíaca média. O dado mais sensível da tabela — só sai pelas RPCs do próprio dono.';

comment on column public.activity_sessions.rota is
  'Trajeto percorrido, no mesmo padrão PostGIS de matches.location e profiles.location (geography sobre SRID 4326, aqui explicitado). Nunca é devolvido para terceiros: GPS de treino desenha rotina e costuma começar na porta de casa.';

comment on column public.activity_sessions.compartilhar_no_feed is
  'Consentimento explícito, opt-in. O default é false e tem que continuar sendo — mudar isso publicaria retroativamente o histórico de saúde de quem nunca pediu.';

-- O acesso quase sempre é "as minhas atividades, da mais recente para a mais
-- antiga" — a tela de perfil e a de histórico fazem exatamente isso.
create index if not exists activity_sessions_user_inicio_idx
  on public.activity_sessions (user_id, inicio desc);

-- E a tela de uma partida pergunta o contrário: quem registrou atividade aqui.
create index if not exists activity_sessions_match_idx
  on public.activity_sessions (match_id);


-- ----------------------------------------------------------------------------
-- 2. RLS — restritiva por padrão
-- ----------------------------------------------------------------------------
alter table public.activity_sessions enable row level security;

-- Leitura: o dono sempre vê o que é dele. Outra pessoa só alcança a linha se
-- as DUAS condições valerem — o dono marcou aquela sessão como pública E o
-- dono deixa esse alguém ver o perfil dele. Não basta uma.
drop policy if exists atividades_leitura on public.activity_sessions;
create policy atividades_leitura on public.activity_sessions
  for select to authenticated
  using (
    auth.uid() = user_id
    or (compartilhar_no_feed and public.pode_ver_perfil(user_id))
  );

-- Escrita: só o dono, sempre. Nem dono de partida, nem parceiro de duplas,
-- ninguém registra atividade em nome de outra pessoa.
drop policy if exists atividades_insercao on public.activity_sessions;
create policy atividades_insercao on public.activity_sessions
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists atividades_atualizacao on public.activity_sessions;
create policy atividades_atualizacao on public.activity_sessions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists atividades_remocao on public.activity_sessions;
create policy atividades_remocao on public.activity_sessions
  for delete to authenticated
  using (auth.uid() = user_id);


-- POR QUE A POLICY SOZINHA NÃO BASTA AQUI
--
-- RLS decide LINHA, não COLUNA. A policy de leitura acima, corretamente,
-- deixa um terceiro autorizado alcançar a linha de uma sessão compartilhada
-- — é o ponto de compartilhar. Só que, alcançada a linha, um `select *` pelo
-- PostgREST traria a linha INTEIRA, batimento e trajeto junto. A policy não
-- tem como dizer "esta linha sim, mas essas três colunas não".
--
-- Quem resolve isso são duas camadas:
--
--   1. privilégio de coluna (aqui embaixo): `authenticated` simplesmente não
--      recebe SELECT em fc_media, fc_max e rota. Quem tentar lê-las direto
--      pela API leva "permission denied for column", dono ou não;
--   2. as RPCs do item 4, que devolvem esses campos apenas para o próprio
--      dono e mascaram explicitamente para todo o resto.
--
-- Se um dia alguém precisar do batimento na tela, o caminho é a RPC
-- `minhas_atividades()` — não é afrouxar o grant abaixo.
-- Zera os dois papéis antes de reconceder. Os default privileges do Supabase
-- dão ALL nas tabelas novas de `public` para anon e authenticated — inclusive
-- SELECT de tabela inteira (que furaria o esquema de coluna abaixo) e
-- TRUNCATE (que RLS não protege, porque RLS filtra linha e TRUNCATE não olha
-- linha nenhuma). `service_role` fica de fora de propósito: é a chave de
-- servidor, não passa por aqui.
revoke all on public.activity_sessions from anon, authenticated;

grant select (
  id, user_id, match_id, fonte, inicio, fim, duracao_s,
  distancia_m, calorias, esforco, compartilhar_no_feed, created_at
) on public.activity_sessions to authenticated;

-- Escrever pode ser na tabela toda: a RLS já garante que a linha escrita é a
-- própria, e o batimento de alguém gravado por essa mesma pessoa não vaza
-- nada. As RPCs continuam sendo o caminho recomendado, porque só elas
-- calculam duração, distância e esforço.
grant insert, update, delete on public.activity_sessions to authenticated;

-- E um aviso para o futuro: esta tabela NÃO entra na publicação
-- `supabase_realtime`. O Realtime avalia a policy de linha, mas não respeita
-- privilégio de coluna — publicar aqui mandaria a linha inteira, batimento e
-- trajeto incluídos, para todo assinante que a policy deixasse passar. Se um
-- dia a tela precisar de atualização ao vivo, o caminho é um canal de
-- broadcast com o payload montado à mão, nunca `postgres_changes` cru.


-- ----------------------------------------------------------------------------
-- 3. CLASSIFICAÇÃO DE ESFORÇO
-- ----------------------------------------------------------------------------
-- Traduz números em uma palavra que o jogador entende sem pensar: foi leve,
-- foi moderado, foi intenso.
--
-- Com batimento, o cálculo é o padrão de fisiologia do esporte: percentual
-- da FC máxima. Abaixo de 60% o corpo está passeando; entre 60% e 75% é a
-- zona aeróbica de verdade; acima de 75% é jogo duro.
--
-- Sem batimento — o caso da ESMAGADORA MAIORIA, porque quase ninguém aqui
-- tem relógio —, sobra a duração. E é uma heurística grosseira, sem meias
-- palavras: duas horas de bate-bola tranquilo com um amigo aparecem como
-- 'intenso' do mesmo jeito que duas horas de torneio. Ela existe porque
-- "não classificado" não ajuda ninguém, não porque esteja certa. Quando
-- houver wearable, o ramo de cima assume e este vira exceção.
--
-- A função é IMMUTABLE, então não pode ler `profiles` para descobrir a idade
-- e estimar a FC máxima. Por isso a FC máxima entra como ARGUMENTO: quem
-- chama (registrar_atividade, que é plpgsql) busca a idade e faz 220 - idade.
create or replace function public.classificar_esforco(
  p_fc_media       smallint,
  p_duracao_s      int,
  p_fc_max_pessoal smallint default null
)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select case
    -- tem batimento: zona sobre a FC máxima
    when p_fc_media is not null and p_fc_media > 0 then
      case
        -- Sem FC máxima informada, 190 é o palpite (≈ 220 - 30, a idade
        -- típica de quem joga tênis amador). Palpite mesmo — quem tem a
        -- idade no perfil deve passar o argumento e não cair aqui.
        when p_fc_media::numeric / greatest(coalesce(p_fc_max_pessoal, 190), 1)::numeric < 0.60 then 'leve'
        when p_fc_media::numeric / greatest(coalesce(p_fc_max_pessoal, 190), 1)::numeric <= 0.75 then 'moderado'
        else 'intenso'
      end

    -- sem batimento: só o relógio de parede
    when p_duracao_s is not null and p_duracao_s > 0 then
      case
        when p_duracao_s <= 2400 then 'leve'       -- até 40 min
        when p_duracao_s <= 4800 then 'moderado'   -- 40 a 80 min
        else 'intenso'                             -- mais que isso
      end

    -- sem batimento e sem duração não há o que classificar. Devolve null em
    -- vez de chutar 'moderado': a coluna aceita null e mentir na tela é pior
    -- do que deixar em branco.
    else null
  end;
$fn$;

comment on function public.classificar_esforco(smallint, int, smallint) is
  'leve/moderado/intenso. Com FC, por zona sobre a FC máxima (60%/75%); sem FC, heurística grosseira por duração (40min/80min).';


-- ----------------------------------------------------------------------------
-- 4. RPCs
-- ----------------------------------------------------------------------------

-- registrar_atividade() — o único caminho de escrita que a tela deveria usar.
-- Ela valida, calcula o que dá para calcular (duração, distância, esforço) e
-- devolve o id da sessão criada.
--
-- Sobre `p_rota`: chega como `[{"lat":-23.5,"lng":-46.6}, ...]`, que é
-- literalmente o formato que a Geolocation API do navegador produz ao longo
-- de um `watchPosition`. Uma LineString exige NO MÍNIMO 2 pontos — e o caso
-- de 0 ou 1 ponto é comum de verdade (jogador que deu permissão de GPS,
-- ficou parado no banco e encerrou). Nesses casos a rota fica null em vez de
-- estourar a função e perder a sessão inteira por causa do trajeto.
--
-- `calorias` não entra por parâmetro de propósito: estimar caloria sem peso
-- e sem batimento é inventar número. A coluna existe para quando houver
-- wearable de verdade.
create or replace function public.registrar_atividade(
  p_match_id     uuid,
  p_fonte        text,
  p_inicio       timestamptz,
  p_fim          timestamptz,
  p_distancia_m  int,
  p_rota         jsonb,
  p_fc_media     smallint,
  p_fc_max       smallint,
  p_compartilhar boolean default false
)
returns uuid
language plpgsql
security definer
-- `extensions` acompanha `public` porque as funções ST_* podem morar lá.
set search_path to 'public', 'extensions'
as $fn$
declare
  v_me      uuid := auth.uid();
  v_id      uuid;
  v_dur     int;
  v_dist    int;
  v_rota    geography;
  v_idade   int;
  v_fcmax   smallint;
  v_esforco text;
begin
  if v_me is null then
    raise exception 'é preciso estar logado para registrar uma atividade';
  end if;

  if p_fonte is null
     or p_fonte not in ('manual', 'gps_web', 'garmin', 'apple_health', 'health_connect') then
    raise exception 'fonte de atividade inválida: %', coalesce(p_fonte, '(vazia)');
  end if;

  if p_inicio is null then
    raise exception 'a atividade precisa de um horário de início';
  end if;

  if p_fim is not null and p_fim < p_inicio then
    raise exception 'o fim da atividade não pode ser antes do início';
  end if;

  -- Vincular a uma partida é afirmar que você jogou aquela partida. Sem essa
  -- checagem, qualquer um penduraria treino em jogo alheio.
  if p_match_id is not null then
    if not exists (
      select 1 from public.participantes_partida(p_match_id) x where x.user_id = v_me
    ) then
      raise exception 'só dá para vincular a atividade a uma partida da qual você participou';
    end if;
  end if;

  if p_fim is not null then
    v_dur := greatest(0, extract(epoch from (p_fim - p_inicio))::int);
  end if;

  -- Monta a LineString. O CTE é `materialized` de propósito: o `->>` só pode
  -- ser convertido para float8 depois que o `jsonb_typeof` já descartou o que
  -- não é número, e materializar impede o planejador de subir o cast para
  -- cima do filtro. Coordenada impossível também cai fora — o navegador às
  -- vezes entrega lixo no primeiro fix, e um cast para geography com lat 999
  -- derrubaria a função inteira.
  --
  -- O `count(*) >= 2` é a regra que importa: com 0 ou 1 ponto a rota fica
  -- null e a sessão é gravada assim mesmo. Perder o trajeto é aceitável;
  -- perder o treino porque o GPS não pegou, não.
  if p_rota is not null and jsonb_typeof(p_rota) = 'array' then
    with brutos as materialized (
      select (t.e->>'lng')::float8 as lng,
             (t.e->>'lat')::float8 as lat,
             t.ord                 as ord
        from jsonb_array_elements(p_rota) with ordinality as t(e, ord)
       where jsonb_typeof(t.e->'lat') = 'number'
         and jsonb_typeof(t.e->'lng') = 'number'
    ),
    validos as (
      select b.lng, b.lat, b.ord
        from brutos b
       where b.lat between -90 and 90
         and b.lng between -180 and 180
    )
    select case
             when count(*) >= 2
               then ST_SetSRID(ST_MakeLine(ST_MakePoint(v.lng, v.lat) order by v.ord), 4326)::geography
           end
      into v_rota
      from validos v;
  end if;

  -- Distância: respeita o que o cliente mandou (um relógio sabe melhor que
  -- a gente); só calcula quando não veio nada e há trajeto para medir.
  -- ST_Length sobre geography já devolve metros.
  v_dist := p_distancia_m;
  if v_dist is null and v_rota is not null then
    v_dist := round(ST_Length(v_rota))::int;
  end if;

  -- Aqui pode ler a tabela — esta função é plpgsql, não immutable. A idade
  -- é a do próprio usuário e nunca sai daqui: vira só um número de FC máxima
  -- que alimenta a classificação.
  select p.idade into v_idade from public.profiles p where p.id = v_me;
  if v_idade is not null and v_idade between 10 and 100 then
    v_fcmax := (220 - v_idade)::smallint;
  end if;

  v_esforco := public.classificar_esforco(p_fc_media, v_dur, v_fcmax);

  insert into public.activity_sessions
    (user_id, match_id, fonte, inicio, fim, duracao_s, distancia_m,
     fc_media, fc_max, esforco, rota, compartilhar_no_feed)
  values
    (v_me, p_match_id, p_fonte, p_inicio, p_fim, v_dur, v_dist,
     p_fc_media, p_fc_max, v_esforco, v_rota, coalesce(p_compartilhar, false))
  returning id into v_id;

  return v_id;
end
$fn$;

comment on function public.registrar_atividade(uuid, text, timestamptz, timestamptz, int, jsonb, smallint, smallint, boolean) is
  'Grava uma sessão do usuário corrente. Calcula duração, distância (quando há rota) e esforço. Rota com menos de 2 pontos vira null em vez de erro.';


-- minhas_atividades() — o histórico do próprio usuário, completo. Batimento
-- e trajeto aparecem aqui porque são dele: esta é a única porta por onde
-- essas três colunas saem do banco, já que o grant de coluna do item 2 as
-- fecha até para o dono no acesso direto.
create or replace function public.minhas_atividades(p_limite int default 30)
returns table (
  id                   uuid,
  match_id             uuid,
  fonte                text,
  inicio               timestamptz,
  fim                  timestamptz,
  duracao_s            int,
  distancia_m          int,
  calorias             int,
  fc_media             smallint,
  fc_max               smallint,
  esforco              text,
  rota                 jsonb,
  compartilhar_no_feed boolean,
  created_at           timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    return;   -- sem sessão, sem histórico
  end if;

  return query
  select a.id,
         a.match_id,
         a.fonte,
         a.inicio,
         a.fim,
         a.duracao_s,
         a.distancia_m,
         a.calorias,
         a.fc_media,   -- dele mesmo
         a.fc_max,     -- dele mesmo
         a.esforco,
         -- GeoJSON para o mapa da tela desenhar o trajeto sem precisar de
         -- PostGIS do lado do cliente.
         case when a.rota is not null then ST_AsGeoJSON(a.rota)::jsonb end,
         a.compartilhar_no_feed,
         a.created_at
    from public.activity_sessions a
   where a.user_id = v_me
   order by a.inicio desc
   limit greatest(coalesce(p_limite, 30), 1);
end
$fn$;

comment on function public.minhas_atividades(int) is
  'Histórico completo do próprio usuário, incluindo FC e trajeto. Única porta de saída dessas colunas.';


-- atividades_do_perfil() — as atividades de OUTRA pessoa. É esta função que
-- segura o dado de saúde, e ela é deliberadamente paranoica; três filtros em
-- série, cada um capaz de barrar sozinho:
--
--   1. se `pode_ver_perfil()` disser não, sai vazio — nem existe conversa
--      sobre atividade de quem não te deixa ver o perfil;
--   2. só linhas com `compartilhar_no_feed = true` — o opt-in explícito;
--   3. fc_media e fc_max saem NULL. Não é esquecimento nem bug: as colunas
--      continuam na assinatura só para a tela ter um formato único, e o
--      `case` abaixo garante que o valor de terceiro nunca viaja. Batimento
--      é informação clínica; "ele deixou a atividade pública" não é
--      consentimento para isso.
--
-- O trajeto não está no retorno de jeito nenhum, nem mascarado: rota de
-- treino revela onde a pessoa mora e a que horas ela sai de casa.
--
-- Quando o usuário pede o próprio perfil (p_user_id = auth.uid()), a função
-- se comporta como dona da casa e devolve tudo, inclusive as sessões
-- privadas. Para o trajeto, ainda assim, o caminho é minhas_atividades().
create or replace function public.atividades_do_perfil(
  p_user_id uuid,
  p_limite  int default 30
)
returns table (
  id                   uuid,
  match_id             uuid,
  fonte                text,
  inicio               timestamptz,
  fim                  timestamptz,
  duracao_s            int,
  distancia_m          int,
  calorias             int,
  fc_media             smallint,
  fc_max               smallint,
  esforco              text,
  compartilhar_no_feed boolean,
  created_at           timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := auth.uid();
  v_eu boolean;
begin
  if v_me is null or p_user_id is null then
    return;
  end if;

  v_eu := (p_user_id = v_me);

  if not v_eu and not public.pode_ver_perfil(p_user_id) then
    return;   -- perfil fechado para mim: nem sei que estas sessões existem
  end if;

  return query
  select a.id,
         a.match_id,
         a.fonte,
         a.inicio,
         a.fim,
         a.duracao_s,
         a.distancia_m,
         a.calorias,
         -- NULL INTENCIONAL para terceiros. Não troque por a.fc_media.
         case when v_eu then a.fc_media end,
         case when v_eu then a.fc_max end,
         a.esforco,
         a.compartilhar_no_feed,
         a.created_at
    from public.activity_sessions a
   where a.user_id = p_user_id
     and (v_eu or a.compartilhar_no_feed)
   order by a.inicio desc
   limit greatest(coalesce(p_limite, 30), 1);
end
$fn$;

comment on function public.atividades_do_perfil(uuid, int) is
  'Atividades públicas de outra pessoa. Exige pode_ver_perfil(), só mostra o que foi compartilhado e zera fc_media/fc_max de terceiros. Nunca devolve o trajeto.';


-- vincular_atividade_partida() — o jogador gravou o treino antes de lembrar
-- que aquilo era a partida de sábado. Liga as duas coisas depois do fato,
-- sem precisar apagar e regravar (o que perderia o trajeto).
--
-- As duas checagens são obrigatórias e independentes: a sessão tem que ser
-- sua, e a partida também. Faltando uma delas, dava para pendurar sessão em
-- partida alheia e aparecer no histórico de quem nunca te viu.
create or replace function public.vincular_atividade_partida(
  p_activity_id uuid,
  p_match_id    uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me   uuid := auth.uid();
  v_dono uuid;
begin
  if v_me is null then
    raise exception 'é preciso estar logado';
  end if;

  if p_activity_id is null or p_match_id is null then
    raise exception 'informe a atividade e a partida';
  end if;

  select a.user_id into v_dono
    from public.activity_sessions a
   where a.id = p_activity_id;

  if v_dono is null then
    raise exception 'atividade não encontrada';
  end if;

  if v_dono <> v_me then
    raise exception 'esta atividade não é sua';
  end if;

  if not exists (
    select 1 from public.participantes_partida(p_match_id) x where x.user_id = v_me
  ) then
    raise exception 'você não participou dessa partida';
  end if;

  update public.activity_sessions
     set match_id = p_match_id
   where id = p_activity_id;
end
$fn$;

comment on function public.vincular_atividade_partida(uuid, uuid) is
  'Liga uma sessão já gravada a uma partida. Só o dono da sessão, e só se ele jogou a partida.';


-- ----------------------------------------------------------------------------
-- 5. GRANTS
-- ----------------------------------------------------------------------------
-- Nada de atividade para quem não está logado. Não existe leitura anônima de
-- dado de saúde nem por engano.
revoke execute on function public.classificar_esforco(smallint, int, smallint) from public, anon;
grant  execute on function public.classificar_esforco(smallint, int, smallint) to authenticated;

revoke execute on function public.registrar_atividade(uuid, text, timestamptz, timestamptz, int, jsonb, smallint, smallint, boolean) from public, anon;
grant  execute on function public.registrar_atividade(uuid, text, timestamptz, timestamptz, int, jsonb, smallint, smallint, boolean) to authenticated;

revoke execute on function public.minhas_atividades(int) from public, anon;
grant  execute on function public.minhas_atividades(int) to authenticated;

revoke execute on function public.atividades_do_perfil(uuid, int) from public, anon;
grant  execute on function public.atividades_do_perfil(uuid, int) to authenticated;

revoke execute on function public.vincular_atividade_partida(uuid, uuid) from public, anon;
grant  execute on function public.vincular_atividade_partida(uuid, uuid) to authenticated;


-- Detalhe fácil de esquecer: `pode_ver_perfil()` é chamada DENTRO da policy
-- de leitura, e policy roda com os privilégios de quem consultou — não com
-- os do dono da função, como acontece nas RPCs. Se essa função só estivesse
-- concedida para uso interno, todo `select` em activity_sessions morreria
-- com "permission denied for function pode_ver_perfil".
--
-- O grant não afrouxa nada: a função devolve exatamente o booleano que a
-- policy já ia aplicar sobre aquela linha, não devolve dado de perfil.
do $grant_visibilidade$
begin
  if to_regprocedure('public.pode_ver_perfil(uuid)') is not null then
    execute 'grant execute on function public.pode_ver_perfil(uuid) to authenticated';
  else
    raise notice 'public.pode_ver_perfil(uuid) não existe neste banco — a policy de leitura de activity_sessions vai falhar. Confira antes de usar a tela de atividades.';
  end if;
end
$grant_visibilidade$;
