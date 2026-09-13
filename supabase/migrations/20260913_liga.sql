-- ============================================================================
-- LIGA — Fase 1
-- ============================================================================
-- Até aqui o ranking era uma lista única e anual: todo mundo no mesmo bolo,
-- e quem entrou em janeiro tem 300 pontos de vantagem sobre quem entrou em
-- agosto. A liga corta esse bolo em duas dimensões:
--
--   • no TEMPO — temporadas trimestrais, para o placar recomeçar quatro vezes
--     por ano e ninguém sentir que já perdeu antes de jogar;
--   • no NÍVEL — cinco divisões, para o jogador de sábado de manhã disputar
--     com gente do tamanho dele e não com o cara que joga desde os oito anos.
--
-- E a vitória deixa de valer sempre o mesmo: ganhar de quem é mais forte
-- rende mais, ganhar de quem é muito mais fraco rende menos. O ELO, que hoje
-- só enfeita o perfil, passa a ser calculado de verdade.
--
-- Este é o PRIMEIRO arquivo de schema versionado do projeto — o resto do
-- banco foi construído à mão no painel do Supabase. Daqui pra frente, toda
-- mudança de schema vira arquivo aqui.
--
-- O arquivo inteiro é idempotente: rodar duas vezes não dá erro e não
-- duplica nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. DIVISÕES
-- ----------------------------------------------------------------------------
-- Catálogo estático de cinco degraus, do saibro de fim de semana ao andar de
-- cima. Os nomes são de quadra, não de metal ("bronze/prata/ouro" é de jogo
-- de celular). A cor sai da paleta de src/theme/tokens.css: o saibro usa o
-- próprio --clay, a grama usa o verde de --ok, a central é o --court da noite
-- sob refletor e os Mestres ficam com a bola de tênis, --ball.
--
-- O id é a própria ordem (1..5) de propósito: promover é +1, rebaixar é -1,
-- e a tabela de divisões nunca vai crescer a ponto de isso incomodar.
create table if not exists public.divisions (
  id      smallint primary key,
  slug    text     not null unique,
  nome    text     not null,
  apelido text,
  cor     text,
  ordem   smallint not null unique
);

comment on table public.divisions is
  'Catálogo fixo das cinco divisões da liga. id == ordem (1 = base, 5 = topo).';

-- Semente. Usa "do update" em vez de "do nothing" para que rodar a migration
-- de novo conserte qualquer nome ou cor que alguém tenha editado na mão.
insert into public.divisions (id, slug, nome, apelido, cor, ordem) values
  (1, 'saibro',  'Saibro',         'Onde todo mundo começa', '#b4472a', 1),
  (2, 'rapida',  'Quadra Rápida',  'O jogo ficou sério',     '#1f5f6e', 2),
  (3, 'grama',   'Grama',          'Poucos chegam aqui',     '#1f7a4c', 3),
  (4, 'central', 'Quadra Central', 'Luz, público, pressão',  '#0d1714', 4),
  (5, 'mestres', 'Mestres',        'O andar de cima',        '#d7f04a', 5)
on conflict (id) do update set
  slug    = excluded.slug,
  nome    = excluded.nome,
  apelido = excluded.apelido,
  cor     = excluded.cor,
  ordem   = excluded.ordem;

-- Catálogo público para quem está logado — não tem nada de pessoal aqui,
-- mas RLS ligada é regra da casa: nenhuma tabela fica sem policy.
alter table public.divisions enable row level security;

drop policy if exists divisoes_leitura on public.divisions;
create policy divisoes_leitura on public.divisions
  for select to authenticated using (true);

-- O revoke vem ANTES do grant, e tira de `authenticated` também. Tirar só de
-- `anon` não bastava: os default privileges do Supabase entregam a tabela nova
-- inteira para `authenticated`, e o que sobrava era INSERT/UPDATE/DELETE — que
-- a RLS barra, porque a única policy aqui é de SELECT — e TRUNCATE, que a RLS
-- NÃO barra. Catálogo de cinco linhas que qualquer sessão logada podia esvaziar.
-- É o mesmo formato de 20260913_atividades.sql.
revoke all on public.divisions from anon, authenticated;
grant select on public.divisions to authenticated;


-- ----------------------------------------------------------------------------
-- 2. TEMPORADAS TRIMESTRAIS
-- ----------------------------------------------------------------------------
-- Uma temporada de um ano inteiro é longa demais: quem chega no meio já chega
-- perdendo, e quem abriu vantagem em março não tem mais o que disputar em
-- outubro. Trimestre dá quatro recomeços por ano.
--
-- A coluna `fechada` marca a temporada que a rotina de virada já processou
-- (promoções, rebaixamentos e carry-over). Sem ela a rotina não teria como
-- saber o que já fez — `ativa` não serve, porque temporada_atual() desliga a
-- anterior no primeiro jogo do trimestre novo, antes mesmo da rotina rodar.
alter table public.seasons
  add column if not exists fechada boolean not null default false;

comment on column public.seasons.fechada is
  'true depois que rotina_temporada() já apurou promoções/rebaixamentos desta temporada.';

-- Uma temporada é identificada pelo seu período. O índice serve tanto para
-- achar rápido quanto para impedir duas linhas do mesmo trimestre se dois
-- jogadores confirmarem placar no mesmo instante da virada.
create unique index if not exists seasons_periodo_idx
  on public.seasons (inicio, fim);

-- A temporada ANUAL de 2026 vira história: sai de cena (ativa = false) e é
-- marcada como já fechada para a rotina de virada não tentar apurar divisão
-- em cima dela em janeiro. Os pontos NÃO se perdem — as linhas de rankings
-- continuam lá, presas àquela season, e ranking_geral() soma tudo.
update public.seasons
   set ativa = false, fechada = true
 where fim - inicio > 100;   -- só as temporadas longas (anuais); trimestre tem ~92 dias


-- temporada_atual() — mesma assinatura, mesmo contrato (acha ou cria, devolve
-- uuid), só que agora o recorte é o trimestre corrente.
create or replace function public.temporada_atual()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_inicio date := date_trunc('quarter', current_date)::date;
  v_fim    date := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
  v_nome   text := 'Temporada ' || extract(year from v_inicio)::int || ' · T' || extract(quarter from v_inicio)::int;
  v_id     uuid;
begin
  select s.id into v_id
    from public.seasons s
   where s.inicio = v_inicio and s.fim = v_fim;

  if v_id is null then
    insert into public.seasons (id, nome, inicio, fim, ativa)
    values (gen_random_uuid(), v_nome, v_inicio, v_fim, true)
    on conflict (inicio, fim) do nothing
    returning id into v_id;

    -- perdeu a corrida com outra transação: a linha já existe, é só ler
    if v_id is null then
      select s.id into v_id
        from public.seasons s
       where s.inicio = v_inicio and s.fim = v_fim;
    end if;
  end if;

  -- exatamente uma temporada ativa: a deste trimestre
  update public.seasons s
     set ativa = (s.id = v_id)
   where s.ativa is distinct from (s.id = v_id);

  return v_id;
end
$fn$;


-- temporada_nome() continua devolvendo o rótulo que a tela de ranking mostra
-- no topo — agora no formato 'Temporada 2026 · T3'.
create or replace function public.temporada_nome()
returns text
language sql
security definer
set search_path to 'public'
as $fn$
  select s.nome from public.seasons s where s.id = public.temporada_atual();
$fn$;


-- ----------------------------------------------------------------------------
-- 3. PESO DO ADVERSÁRIO
-- ----------------------------------------------------------------------------
-- A base não muda (50 pts no 2x0, 35 no 2x1 — está escrito na tela e o
-- jogador já decorou). O que muda é o multiplicador: bater alguém 400 de ELO
-- acima vale 1,6x; atropelar alguém 400 abaixo vale 0,6x. Sem isso, a
-- estratégia ótima da liga seria caçar iniciante, que é exatamente o
-- comportamento que afasta iniciante do app.
create or replace function public.fator_adversario(p_elo_vencedor int, p_elo_perdedor int)
returns numeric
language sql
immutable
set search_path to 'public'
as $fn$
  select greatest(0.6, least(1.6,
    1 + (coalesce(p_elo_perdedor, 1200) - coalesce(p_elo_vencedor, 1200))::numeric / 400.0
  ));
$fn$;

comment on function public.fator_adversario(int, int) is
  'Multiplicador dos pontos pela diferença de ELO, limitado a [0.6, 1.6].';


-- ELO clássico. K maior (32) enquanto o jogador tem menos de 10 partidas,
-- para o rating dele achar o lugar certo rápido; depois cai para 24 e passa
-- a se mover devagar.
create or replace function public.novo_elo(
  p_elo            int,
  p_elo_adversario int,
  p_resultado      numeric,   -- 1 = venceu, 0 = perdeu
  p_jogos          int
)
returns int
language sql
immutable
set search_path to 'public'
as $fn$
  select round(
    coalesce(p_elo, 1200)
    + (case when coalesce(p_jogos, 0) < 10 then 32 else 24 end)
      * (coalesce(p_resultado, 0)
         - 1.0 / (1.0 + power(10.0::numeric,
             (coalesce(p_elo_adversario, 1200) - coalesce(p_elo, 1200))::numeric / 400.0)))
  )::int;
$fn$;

comment on function public.novo_elo(int, int, numeric, int) is
  'ELO novo do jogador. K = 32 com menos de 10 jogos, 24 depois disso.';


-- ----------------------------------------------------------------------------
-- 4. AJUDANTES DA LIGA
-- ----------------------------------------------------------------------------
-- Tamanho da faixa de promoção/rebaixamento de uma divisão: 20% dela, nunca
-- menos de 1. Fica numa função só para a tela ("faltam X pontos pra subir")
-- e a apuração do fim da temporada nunca discordarem uma da outra.
create or replace function public.liga_faixa(p_total int)
returns int
language sql
immutable
set search_path to 'public'
as $fn$
  select greatest(1, floor(coalesce(p_total, 0) * 0.2)::int);
$fn$;


-- Tendência é sobre POSIÇÃO, não sobre pontos: pontos só sobem, então
-- comparar pontos diria "subindo" para todo mundo. O que o jogador quer
-- saber é se ele ganhou ou perdeu lugares desde o último jogo dele.
-- Sem posição anterior (primeiro jogo da temporada), cai no comparativo de
-- pontos só para não mentir dizendo que caiu.
create or replace function public.liga_tendencia(
  p_posicao           int,
  p_posicao_anterior  int,
  p_pontos            int,
  p_pontos_anteriores int
)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select case
    when p_posicao_anterior is null then
      case when coalesce(p_pontos, 0) > coalesce(p_pontos_anteriores, 0) then 'subindo' else 'estavel' end
    when p_posicao < p_posicao_anterior then 'subindo'
    when p_posicao > p_posicao_anterior then 'descendo'
    else 'estavel'
  end;
$fn$;


-- ----------------------------------------------------------------------------
-- 5. RANKINGS GANHA A DIMENSÃO DE LIGA
-- ----------------------------------------------------------------------------
-- A tabela já guardava pontos/vitórias/derrotas por temporada. Agora guarda
-- também em que divisão o jogador está, quantos jogos fez (a promoção exige
-- no mínimo 3, senão quem jogou uma vez e ganhou subiria) e a fotografia da
-- leitura anterior, que é o que permite dizer "você subiu 3 posições".
alter table public.rankings
  add column if not exists division_id smallint not null default 1 references public.divisions(id),
  add column if not exists jogos int not null default 0,
  add column if not exists elo_inicio int,
  add column if not exists pontos_anteriores int not null default 0,
  add column if not exists posicao_anterior int;

comment on column public.rankings.elo_inicio is
  'ELO do jogador quando entrou nesta temporada — serve para mostrar a evolução do trimestre.';
comment on column public.rankings.posicao_anterior is
  'Posição antes do último jogo confirmado deste jogador. Base da tendência.';

create index if not exists rankings_season_division_idx
  on public.rankings (season_id, division_id, pontos desc);


-- ----------------------------------------------------------------------------
-- 6. MINHA LIGA
-- ----------------------------------------------------------------------------
-- Uma linha com tudo que a tela da liga precisa: em que divisão eu estou,
-- em que posição, e quanto falta pra subir. Sem precisar abrir outra tela.
--
-- Atenção à posição: rankings.posicao continua sendo a colocação GERAL da
-- temporada (é o que ranking_temporada() já mostra e não vamos quebrar). A
-- posição DENTRO da divisão é calculada na hora, aqui, com row_number().
create or replace function public.minha_liga()
returns table (
  division_id         smallint,
  division_slug       text,
  division_nome       text,
  division_apelido    text,
  division_cor        text,
  division_ordem      smallint,
  temporada_nome      text,
  temporada_fim       date,
  pontos              int,
  posicao             int,
  total_na_divisao    int,
  vitorias            int,
  derrotas            int,
  jogos               int,
  elo                 int,
  tendencia           text,
  pontos_para_promocao int,
  promovendo          boolean,
  rebaixando          boolean
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me       uuid := auth.uid();
  v_season   uuid;
  v_tem_linha boolean := false;
  v_div      smallint := 1;
  v_pontos   int := 0;
  v_pontos_ant int := 0;
  v_vit      int := 0;
  v_der      int := 0;
  v_jogos    int := 0;
  v_pos      int;
  v_pos_ant  int;
  v_total    int := 0;
  v_faixa    int;
  v_corte    int;
  v_elo      int := 1200;
  v_d        record;
  v_s        record;
begin
  if v_me is null then
    return;   -- sem sessão, sem liga
  end if;

  v_season := public.temporada_atual();

  select rk.division_id, rk.pontos, rk.pontos_anteriores, rk.vitorias, rk.derrotas,
         rk.jogos, rk.posicao_anterior
    into v_div, v_pontos, v_pontos_ant, v_vit, v_der, v_jogos, v_pos_ant
    from public.rankings rk
   where rk.season_id = v_season and rk.user_id = v_me;

  -- Cuidado: um SELECT INTO que não acha linha deixa TODOS os alvos nulos,
  -- não só os que faltam. Normaliza tudo antes de seguir.
  v_tem_linha := found;
  v_div    := coalesce(v_div, 1);   -- todo mundo começa no saibro
  v_pontos := coalesce(v_pontos, 0);
  v_pontos_ant := coalesce(v_pontos_ant, 0);
  v_vit    := coalesce(v_vit, 0);
  v_der    := coalesce(v_der, 0);
  v_jogos  := coalesce(v_jogos, 0);

  select coalesce(p.elo_rating, 1200) into v_elo
    from public.profiles p where p.id = v_me;
  v_elo := coalesce(v_elo, 1200);

  select count(*)::int into v_total
    from public.rankings rk
   where rk.season_id = v_season and rk.division_id = v_div;

  if v_tem_linha then
    select x.rn into v_pos from (
      select rk.user_id,
             row_number() over (order by rk.pontos desc, rk.vitorias desc, rk.derrotas asc, rk.user_id) as rn
        from public.rankings rk
       where rk.season_id = v_season and rk.division_id = v_div
    ) x where x.user_id = v_me;
  else
    -- ainda não pontuou nesta temporada: entra como o último da divisão,
    -- contando a si mesmo no total para a tela não dizer "6º de 5".
    v_total := v_total + 1;
    v_pos   := v_total;
  end if;

  select d.slug, d.nome, d.apelido, d.cor, d.ordem into v_d
    from public.divisions d where d.id = v_div;

  select s.nome, s.fim into v_s
    from public.seasons s where s.id = v_season;

  v_faixa := public.liga_faixa(v_total);

  -- Quanto falta para alcançar o último jogador da faixa de promoção. Quem
  -- já está na faixa (ou está nos Mestres, onde não há degrau acima) vê 0.
  if v_d.ordem >= 5 or v_pos <= v_faixa then
    v_corte := 0;
  else
    select greatest(0, coalesce(x.pontos, 0) - v_pontos)::int into v_corte
      from (
        select rk.pontos
          from public.rankings rk
         where rk.season_id = v_season and rk.division_id = v_div
         order by rk.pontos desc, rk.vitorias desc, rk.derrotas asc, rk.user_id
         offset greatest(v_faixa - 1, 0) limit 1
      ) x;
    v_corte := coalesce(v_corte, 0);
  end if;

  return query select
    v_div,
    v_d.slug,
    v_d.nome,
    v_d.apelido,
    v_d.cor,
    v_d.ordem,
    v_s.nome,
    v_s.fim,
    v_pontos,
    v_pos,
    v_total,
    v_vit,
    v_der,
    v_jogos,
    v_elo,
    public.liga_tendencia(v_pos, v_pos_ant, v_pontos, v_pontos_ant),
    v_corte,
    -- se a temporada acabasse agora
    (v_d.ordem < 5 and v_pos <= v_faixa and v_jogos >= 3),
    (v_d.ordem > 1 and v_jogos >= 3
      and v_pos > (v_total - v_faixa) and v_pos > v_faixa);
end
$fn$;


-- ----------------------------------------------------------------------------
-- 7. CLASSIFICAÇÃO DA DIVISÃO
-- ----------------------------------------------------------------------------
-- O leaderboard de uma divisão. Sem argumento, mostra a divisão de quem
-- perguntou.
--
-- PRIVACIDADE: cidade, uf e avatar passam por pode_ver_perfil()/pode_ver_fotos()
-- coluna a coluna, igualzinho ao ranking_temporada(). O nome é público (é o
-- que identifica o jogador no ranking) e o ELO também — é número de jogo, não
-- dado pessoal. Não copie este SELECT tirando os CASE: a privacidade deste
-- app é aplicada aqui, no banco, e não na tela.
create or replace function public.liga_classificacao(
  p_division_id smallint default null,
  p_limite      int default 50
)
returns table (
  user_id   uuid,
  nome      text,
  avatar    text,
  cidade    text,
  uf        text,
  pontos    int,
  vitorias  int,
  derrotas  int,
  jogos     int,
  elo       int,
  posicao   int,
  tendencia text,
  eu        boolean
)
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me     uuid := auth.uid();
  v_season uuid;
  v_div    smallint;
begin
  if v_me is null then
    return;
  end if;

  v_season := public.temporada_atual();
  v_div := p_division_id;

  if v_div is null then
    select rk.division_id into v_div
      from public.rankings rk
     where rk.season_id = v_season and rk.user_id = v_me;
    v_div := coalesce(v_div, 1);
  end if;

  return query
  with ordenado as (
    select rk.user_id,
           rk.pontos,
           rk.vitorias,
           rk.derrotas,
           rk.jogos,
           rk.posicao_anterior,
           rk.pontos_anteriores,
           row_number() over (order by rk.pontos desc, rk.vitorias desc, rk.derrotas asc, rk.user_id) as rn
      from public.rankings rk
     where rk.season_id = v_season and rk.division_id = v_div
  )
  select o.user_id,
         pr.nome,
         case when public.pode_ver_fotos(pr.id)  then pr.avatar_url end,
         case when public.pode_ver_perfil(pr.id) then pr.cidade end,
         case when public.pode_ver_perfil(pr.id) then pr.uf end,
         o.pontos,
         o.vitorias,
         o.derrotas,
         o.jogos,
         coalesce(pr.elo_rating, 1200),
         o.rn::int,
         public.liga_tendencia(o.rn::int, o.posicao_anterior, o.pontos, o.pontos_anteriores),
         (o.user_id = v_me)
    from ordenado o
    join public.profiles pr on pr.id = o.user_id
   order by o.rn
   limit greatest(coalesce(p_limite, 50), 1);
end
$fn$;


-- ----------------------------------------------------------------------------
-- 8. VIRADA DE TEMPORADA
-- ----------------------------------------------------------------------------
-- Roda todo dia de madrugada e, na esmagadora maioria das vezes, não faz
-- nada. Quando o trimestre vira, ela:
--   • apura cada divisão: 20% do topo sobem, 20% do fundo descem (mínimo 1
--     de cada lado), e só conta quem jogou pelo menos 3 partidas — quem
--     apareceu uma vez e ganhou não sobe de divisão por sorte;
--   • abre a temporada nova com 25% dos pontos antigos de carry-over, para
--     o recomeço não ser um zero absoluto que apaga o trimestre inteiro;
--   • avisa quem subiu e quem desceu.
--
-- É idempotente pela coluna seasons.fechada: a temporada apurada é marcada
-- e nunca mais é processada. Rodar a função dez vezes no mesmo dia dá no
-- mesmo que rodar uma.
create or replace function public.rotina_temporada()
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_old       record;
  v_new       uuid;
  v_new_nome  text;
  r           record;
  v_destino   smallint;
  v_carry     int;
  v_elo       int;
  v_nome_div  text;
begin
  -- A temporada encerrada mais recente que ainda não foi apurada.
  select s.* into v_old
    from public.seasons s
   where s.fim < current_date and not s.fechada
   order by s.fim desc
   limit 1;

  if v_old.id is null then
    return;   -- temporada em andamento, nada a apurar
  end if;

  -- Se houver temporadas antigas penduradas (banco parado por meses, por
  -- exemplo), elas viram história sem apuração: só a última vale.
  update public.seasons s
     set fechada = true, ativa = false
   where s.fim < current_date and not s.fechada and s.id <> v_old.id;

  v_new := public.temporada_atual();
  if v_new = v_old.id then
    return;   -- cinto de segurança: nunca apurar a temporada corrente
  end if;

  select s.nome into v_new_nome from public.seasons s where s.id = v_new;

  for r in
    with base as (
      select rk.user_id,
             rk.division_id,
             rk.pontos,
             rk.jogos,
             row_number() over (
               partition by rk.division_id
               order by rk.pontos desc, rk.vitorias desc, rk.derrotas asc, rk.user_id
             ) as rn,
             count(*) over (partition by rk.division_id) as total
        from public.rankings rk
       where rk.season_id = v_old.id
    )
    select b.user_id,
           b.division_id,
           b.pontos,
           b.jogos,
           d.ordem,
           b.rn,
           b.total,
           public.liga_faixa(b.total::int) as faixa
      from base b
      join public.divisions d on d.id = b.division_id
  loop
    v_destino := r.division_id;

    if r.jogos >= 3 then
      if r.ordem < 5 and r.rn <= r.faixa then
        -- sobe um degrau (Mestres não tem para onde subir)
        select d.id into v_destino from public.divisions d where d.ordem = r.ordem + 1;
      elsif r.ordem > 1
        and r.rn > (r.total - r.faixa)
        and r.rn > r.faixa then
        -- desce um degrau. O "rn > faixa" evita o absurdo de uma divisão com
        -- um jogador só, onde a mesma pessoa seria promovida e rebaixada.
        select d.id into v_destino from public.divisions d where d.ordem = r.ordem - 1;
      end if;
    end if;

    v_destino := coalesce(v_destino, r.division_id);
    v_carry := round(coalesce(r.pontos, 0) * 0.25)::int;

    select coalesce(p.elo_rating, 1200) into v_elo
      from public.profiles p where p.id = r.user_id;

    -- Semeia a temporada nova. O "do update" cobre o caso de o jogador já ter
    -- confirmado um placar no trimestre novo antes da rotina rodar: ele fica
    -- com a divisão apurada e o carry-over somado ao que já pontuou.
    insert into public.rankings
      (season_id, user_id, division_id, pontos, vitorias, derrotas, jogos,
       elo_inicio, pontos_anteriores, posicao_anterior)
    values
      (v_new, r.user_id, v_destino, v_carry, 0, 0, 0,
       coalesce(v_elo, 1200), v_carry, null)
    on conflict (season_id, user_id) do update set
      division_id       = excluded.division_id,
      pontos            = public.rankings.pontos + excluded.pontos,
      pontos_anteriores = public.rankings.pontos_anteriores + excluded.pontos,
      elo_inicio        = coalesce(public.rankings.elo_inicio, excluded.elo_inicio);

    if v_destino <> r.division_id then
      select d.nome into v_nome_div from public.divisions d where d.id = v_destino;

      perform public.criar_notificacao(
        r.user_id,
        case when v_destino > r.division_id then 'liga_promocao' else 'liga_rebaixamento' end,
        jsonb_build_object(
          'division_id',   v_destino,
          'division_nome', v_nome_div,
          'temporada',     v_new_nome
        )
      );
    end if;
  end loop;

  -- Recalcula a colocação geral da temporada nova (o carry-over já entrou).
  with ord as (
    select rk.user_id,
           row_number() over (order by rk.pontos desc, rk.vitorias desc) as rn
      from public.rankings rk
     where rk.season_id = v_new
  )
  update public.rankings rk
     set posicao = ord.rn
    from ord
   where ord.user_id = rk.user_id and rk.season_id = v_new;

  update public.seasons s
     set ativa = false, fechada = true
   where s.id = v_old.id;
end
$fn$;


-- Os avisos de liga são tipos novos de notificação. Se a coluna `tipo` for um
-- enum (e não text), ela precisa aprender as duas etiquetas novas antes da
-- primeira virada de temporada — senão a rotina quebra em produção num
-- domingo de madrugada. Bloco defensivo: não faz nada se a coluna já for text.
do $enum$
declare
  v_rel regclass := coalesce(to_regclass('public.notifications'), to_regclass('public.notificacoes'));
  v_typ oid;
begin
  if v_rel is null then
    return;
  end if;

  select a.atttypid into v_typ
    from pg_attribute a
   where a.attrelid = v_rel and a.attname = 'tipo' and not a.attisdropped;

  if v_typ is null or (select t.typtype from pg_type t where t.oid = v_typ) <> 'e' then
    return;
  end if;

  if not exists (select 1 from pg_enum e where e.enumtypid = v_typ and e.enumlabel = 'liga_promocao') then
    execute format('alter type %s add value %L', v_typ::regtype::text, 'liga_promocao');
  end if;
  if not exists (select 1 from pg_enum e where e.enumtypid = v_typ and e.enumlabel = 'liga_rebaixamento') then
    execute format('alter type %s add value %L', v_typ::regtype::text, 'liga_rebaixamento');
  end if;
exception when others then
  raise notice 'não consegui ajustar o enum de notificações (%). Confira antes da primeira virada.', sqlerrm;
end
$enum$;


-- Agendamento: uma vez por dia, 06:00 UTC (03:00 em Brasília) — horário em
-- que ninguém está confirmando placar. Mesmo estilo da rotina_lembretes.
do $cron$
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then
    raise notice 'pg_cron não está instalado: agende rotina_temporada() na mão.';
    return;
  end if;

  begin
    perform cron.unschedule('rotina-temporada');
  exception when others then
    null;   -- ainda não existia, tudo bem
  end;

  perform cron.schedule('rotina-temporada', '0 6 * * *', 'select public.rotina_temporada();');
end
$cron$;


-- ----------------------------------------------------------------------------
-- 9. CONFIRMAR RESULTADO — agora com peso e ELO
-- ----------------------------------------------------------------------------
-- Tudo que a função já fazia continua igual: as mesmas validações, o post no
-- feed, as notificações, a partida virando 'jogada', o acúmulo em profiles e
-- o recálculo da colocação geral. O que entrou:
--
--   • os pontos são multiplicados pelo fator do adversário e gravados DE
--     VOLTA em match_results.pontos — o feed tem que mostrar o valor que de
--     fato entrou no ranking, não a base teórica;
--   • o ELO dos dois lados se move de verdade. Em duplas, o time vale a média
--     do ELO dos seus integrantes e o delta calculado para o time é aplicado
--     a cada um — a dupla ganha e perde junto;
--   • jogos + 1, e a fotografia (pontos/posição) de antes deste jogo fica
--     guardada para a tela conseguir dizer "você subiu 3 posições".
create or replace function public.confirmar_resultado(p_result_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := auth.uid();
  res record;
  v_season uuid;
  u uuid;
  r record;
  v_elo_venc   int;
  v_elo_perd   int;
  v_jogos_venc int;
  v_jogos_perd int;
  v_fator      numeric;
  v_pontos     int;
  v_delta_venc int;
  v_delta_perd int;
  v_elo_u      int;
begin
  select * into res from public.match_results where id = p_result_id;
  if res.id is null then raise exception 'resultado não encontrado'; end if;
  if res.status = 'confirmado' then raise exception 'este placar já foi confirmado'; end if;
  if res.reporter_id = v_me then raise exception 'quem registrou não pode confirmar sozinho'; end if;
  if not exists (select 1 from public.participantes_partida(res.match_id) x where x.user_id = v_me) then
    raise exception 'só quem jogou pode confirmar o placar';
  end if;

  v_season := public.temporada_atual();

  -- Força de cada lado. Em simples é o próprio jogador; em duplas, a média.
  select coalesce(round(avg(p.elo_rating))::int, 1200),
         coalesce(round(avg(coalesce(p.vitorias, 0) + coalesce(p.derrotas, 0)))::int, 0)
    into v_elo_venc, v_jogos_venc
    from public.profiles p where p.id = any(res.vencedores);

  select coalesce(round(avg(p.elo_rating))::int, 1200),
         coalesce(round(avg(coalesce(p.vitorias, 0) + coalesce(p.derrotas, 0)))::int, 0)
    into v_elo_perd, v_jogos_perd
    from public.profiles p where p.id = any(res.perdedores);

  v_elo_venc   := coalesce(v_elo_venc, 1200);
  v_elo_perd   := coalesce(v_elo_perd, 1200);
  v_jogos_venc := coalesce(v_jogos_venc, 0);
  v_jogos_perd := coalesce(v_jogos_perd, 0);

  v_fator  := public.fator_adversario(v_elo_venc, v_elo_perd);
  v_pontos := greatest(0, round(coalesce(res.pontos, 0) * v_fator)::int);

  v_delta_venc := public.novo_elo(v_elo_venc, v_elo_perd, 1, v_jogos_venc) - v_elo_venc;
  v_delta_perd := public.novo_elo(v_elo_perd, v_elo_venc, 0, v_jogos_perd) - v_elo_perd;

  -- Os pontos ponderados viram o valor oficial deste placar.
  update public.match_results
     set status = 'confirmado', confirmado_por = v_me, confirmado_em = now(), pontos = v_pontos::smallint
   where id = p_result_id;

  update public.matches set status = 'jogada' where id = res.match_id;

  foreach u in array res.vencedores loop
    select p.elo_rating into v_elo_u from public.profiles p where p.id = u;
    v_elo_u := coalesce(v_elo_u, 1200);

    -- O "do update" guarda pontos/posição de ANTES deste jogo (as expressões
    -- do SET enxergam a linha antiga) e só depois soma o que foi ganho.
    insert into public.rankings
      (season_id, user_id, division_id, pontos, vitorias, derrotas, jogos, elo_inicio,
       pontos_anteriores, posicao_anterior)
    values (v_season, u, 1, v_pontos, 1, 0, 1, v_elo_u, 0, null)
    on conflict (season_id, user_id) do update set
      pontos_anteriores = public.rankings.pontos,
      posicao_anterior  = public.rankings.posicao,
      pontos            = public.rankings.pontos + excluded.pontos,
      vitorias          = public.rankings.vitorias + 1,
      jogos             = public.rankings.jogos + 1,
      elo_inicio        = coalesce(public.rankings.elo_inicio, excluded.elo_inicio);

    update public.profiles
       set pontos = pontos + v_pontos,
           vitorias = vitorias + 1,
           elo_rating = greatest(100, elo_rating + v_delta_venc)
     where id = u;
  end loop;

  foreach u in array res.perdedores loop
    select p.elo_rating into v_elo_u from public.profiles p where p.id = u;
    v_elo_u := coalesce(v_elo_u, 1200);

    insert into public.rankings
      (season_id, user_id, division_id, pontos, vitorias, derrotas, jogos, elo_inicio,
       pontos_anteriores, posicao_anterior)
    values (v_season, u, 1, 0, 0, 1, 1, v_elo_u, 0, null)
    on conflict (season_id, user_id) do update set
      pontos_anteriores = public.rankings.pontos,
      posicao_anterior  = public.rankings.posicao,
      derrotas          = public.rankings.derrotas + 1,
      jogos             = public.rankings.jogos + 1,
      elo_inicio        = coalesce(public.rankings.elo_inicio, excluded.elo_inicio);

    -- piso de 100 para o ELO: derrota não empurra ninguém para o absurdo
    update public.profiles
       set derrotas = derrotas + 1,
           elo_rating = greatest(100, elo_rating + v_delta_perd)
     where id = u;
  end loop;

  with ord as (
    select user_id, row_number() over (order by pontos desc, vitorias desc) as rn
      from public.rankings where season_id = v_season
  )
  update public.rankings rk set posicao = ord.rn
    from ord where ord.user_id = rk.user_id and rk.season_id = v_season;

  insert into public.posts (user_id, tipo, result_id, match_id, legenda, fotos)
  values (res.reporter_id, 'resultado', res.id, res.match_id, res.legenda, coalesce(res.fotos, '{}'))
  on conflict (result_id) do nothing;

  for r in select * from public.participantes_partida(res.match_id, v_me) loop
    perform public.criar_notificacao(r.user_id, 'resultado_confirmado',
      jsonb_build_object('match_id', res.match_id, 'result_id', p_result_id, 'from_id', v_me));
  end loop;
end
$fn$;


-- ----------------------------------------------------------------------------
-- 10. GRANTS
-- ----------------------------------------------------------------------------
-- Nada de liga para quem não está logado. A rotina de virada não é de
-- ninguém a não ser do cron.
--
-- Repare no "from public, anon" e não só no "from anon": o Postgres concede
-- EXECUTE a PUBLIC em toda função nova, e anon herda de PUBLIC. Revogar só de
-- anon não tira nada — a porta continua aberta. Verificado com
-- has_function_privilege('anon', ...) num Postgres de teste.
revoke execute on function public.fator_adversario(int, int) from public, anon;
grant  execute on function public.fator_adversario(int, int) to authenticated, service_role;

revoke execute on function public.novo_elo(int, int, numeric, int) from public, anon;
grant  execute on function public.novo_elo(int, int, numeric, int) to authenticated, service_role;

revoke execute on function public.liga_faixa(int) from public, anon;
grant  execute on function public.liga_faixa(int) to authenticated, service_role;

revoke execute on function public.liga_tendencia(int, int, int, int) from public, anon;
grant  execute on function public.liga_tendencia(int, int, int, int) to authenticated, service_role;

revoke execute on function public.minha_liga() from public, anon;
grant  execute on function public.minha_liga() to authenticated, service_role;

revoke execute on function public.liga_classificacao(smallint, int) from public, anon;
grant  execute on function public.liga_classificacao(smallint, int) to authenticated, service_role;

revoke execute on function public.temporada_atual() from public, anon;
grant  execute on function public.temporada_atual() to authenticated, service_role;

revoke execute on function public.temporada_nome() from public, anon;
grant  execute on function public.temporada_nome() to authenticated, service_role;

revoke execute on function public.confirmar_resultado(uuid) from public, anon;
grant  execute on function public.confirmar_resultado(uuid) to authenticated, service_role;

revoke execute on function public.rotina_temporada() from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 11. ABERTURA DA PRIMEIRA TEMPORADA TRIMESTRAL
-- ----------------------------------------------------------------------------
-- Cria (e deixa ativa) a temporada do trimestre corrente. A anual de 2026 já
-- saiu de cena lá em cima, com os pontos dela preservados no histórico.
select public.temporada_atual();

-- ----------------------------------------------------------------------------
-- 12. A PONTE PARA A PRIMEIRA TEMPORADA TRIMESTRAL
-- ----------------------------------------------------------------------------
-- Pegadinha descoberta na aplicação: a seção 2 aposenta a temporada anual, mas
-- quem faz a travessia de uma temporada para a outra é a rotina_temporada() —
-- e ela só age quando uma temporada CHEGA ao fim sozinha. Como esta
-- aposentadoria é manual, ninguém atravessaria: a primeira temporada
-- trimestral nasceria vazia e a tela da Liga abriria sem uma alma dentro.
--
-- Aqui a ponte é atravessada à mão, com exatamente a mesma regra que a rotina
-- aplicaria: 25% de carry-over e todo mundo estreando no Saibro. O
-- `on conflict do nothing` mantém isto idempotente e impede que rodar a
-- migration de novo dê pontos em dobro para alguém.
insert into public.rankings
  (season_id, user_id, division_id, pontos, vitorias, derrotas, jogos,
   elo_inicio, pontos_anteriores, posicao_anterior)
select public.temporada_atual(),
       antigo.user_id,
       1,
       round(antigo.pontos * 0.25)::int,
       0, 0, 0,
       coalesce(p.elo_rating, 1200),
       round(antigo.pontos * 0.25)::int,
       null
  from public.rankings antigo
  join public.seasons s on s.id = antigo.season_id and s.fechada
  join public.profiles p on p.id = antigo.user_id
on conflict (season_id, user_id) do nothing;

with ord as (
  select rk.user_id,
         row_number() over (order by rk.pontos desc, rk.vitorias desc) as rn
    from public.rankings rk
   where rk.season_id = public.temporada_atual()
)
update public.rankings rk
   set posicao = ord.rn
  from ord
 where ord.user_id = rk.user_id and rk.season_id = public.temporada_atual();
