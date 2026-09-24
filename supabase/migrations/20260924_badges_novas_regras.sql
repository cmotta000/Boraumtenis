-- ============================================================================
-- BADGES — duas medidas novas: streak semanal e selo de campeão
-- ============================================================================
-- Esta é a migration que testa se o desenho de 20260923_badges.sql valia o que
-- prometia. O que ela contém:
--
--   • 1 linha nova em `badges` (a do streak semanal — o selo de campeão fica
--     sem badge aqui, e o bloco 1 explica por quê);
--   • 2 `when` novos em `badge_medida()`.
--
-- E o que ela NÃO contém, porque não precisou: nada em `avaliar_badges()`,
-- nada em `avaliar_badges_seguro()`, nenhum gatilho novo, nenhuma mudança nas
-- policies, nos grants ou na RPC de leitura. A concessão, a idempotência e a
-- proteção contra derrubar o placar continuam exatamente como foram aplicadas.
--
-- ORDEM: o nome é 20260924 (e não 20260923) para não depender de detalhe de
-- ordenação de caractere — este arquivo PRECISA rodar depois de
-- `20260923_badges.sql`, que é quem cria `badge_medida()` pela primeira vez.
--
-- SOBRE A CÓPIA: `badge_medida()` é reescrita inteira aqui, porque
-- `create or replace` não sabe aplicar remendo. A partir de hoje, a definição
-- que vale é ESTA — quem for acrescentar a sexta medida parte deste arquivo,
-- não do de ontem.
--
-- Idempotente: rodar duas vezes não dá erro, não duplica badge e não move a
-- data de conquista de ninguém.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. A CONQUISTA NOVA (uma só — leia o porquê antes de acrescentar a outra)
-- ----------------------------------------------------------------------------
-- Mesmo `on conflict (slug) do update` do catálogo original: reaplicar com
-- outro limiar atualiza a regra, e quem já conquistou não perde.
insert into public.badges (slug, nome, descricao, icone, regra) values
  ('toda-semana', 'Toda semana na quadra',
   'Quatro semanas seguidas com jogo no mesmo mês.',
   'calendar-days',
   '{"tipo": "semanas_seguidas_no_mes", "minimo": 4}'::jsonb)

on conflict (slug) do update set
  nome      = excluded.nome,
  descricao = excluded.descricao,
  icone     = excluded.icone,
  regra     = excluded.regra;

-- O BADGE DE CAMPEÃO NÃO É SEMEADO AQUI, DE PROPÓSITO.
--
-- A medida `temporadas_como_campeao` existe logo abaixo e funciona, mas não há
-- linha em `badges` apontando para ela — e sem linha o motor não concede nada.
--
-- Motivo, descoberto no dado e não no código: existe uma temporada com
-- `fechada = true` que NUNCA FOI DISPUTADA — a "Temporada 2026" anual, que foi
-- aposentada quando a liga virou trimestral. Ela tem primeiro colocado em
-- `rankings`. Semear o selo aqui daria "Campeão da temporada", em caráter
-- PERMANENTE (`user_badges` nunca é apagado), para alguém que não ganhou
-- campeonato nenhum.
--
-- Quem resolve isso é `20260925_badges_campeao_divisao.sql`, que marca as
-- temporadas que valem título e semeia o selo certo — o de campeão DA
-- DIVISÃO. A medida geral fica aqui de reserva, sem badge, para o caso de um
-- dia existir um selo raro de campeão geral.


-- ----------------------------------------------------------------------------
-- 2. badge_medida() — as três de antes, mais as duas novas
-- ----------------------------------------------------------------------------
-- As três primeiras medidas estão IDÊNTICAS ao arquivo de origem. As duas
-- últimas são a novidade. Nada mais na função mudou: mesma assinatura, mesmo
-- contrato (devolve um inteiro, ou NULL quando não sabe medir), mesmo
-- `security definer` e mesmo `search_path`.
create or replace function public.badge_medida(p_user_id uuid, p_regra jsonb)
returns int
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_tipo   text := p_regra->>'tipo';
  v_medida int;
begin
  if p_user_id is null or v_tipo is null then
    return null;
  end if;

  case v_tipo

  -- Vitórias seguidas AGORA, contando do jogo mais recente para trás até
  -- esbarrar na primeira derrota. É a sequência corrente, e basta: o motor
  -- roda a cada resultado confirmado, então no instante em que a terceira
  -- vitória entra a medida vale 3. Como `user_badges` nunca é apagado, perder
  -- o jogo seguinte não tira a conquista.
  when 'sequencia_vitorias' then
    with jogos as (
      select (p_user_id = any(r.vencedores)) as venceu,
             row_number() over (order by r.confirmado_em desc nulls last, r.id desc) as rn
        from public.match_results r
       where r.status = 'confirmado'
         and (p_user_id = any(r.vencedores) or p_user_id = any(r.perdedores))
    )
    select count(*)::int
      into v_medida
      from jogos j
     where j.rn < coalesce((select min(d.rn) from jogos d where not d.venceu), 2147483647);

  -- Já esteve alguma vez nesta divisão? 1 = sim, 0 = ainda não.
  when 'estreia_divisao' then
    select case when exists (
             select 1
               from public.rankings k
              where k.user_id = p_user_id
                and k.division_id = (p_regra->>'division_id')::smallint
           ) then 1 else 0 end
      into v_medida;

  -- Partidas confirmadas no mês corrente. O corte usa `now()` no fuso do
  -- servidor (UTC) — imprecisão conhecida e aceita, detalhada no arquivo de
  -- origem.
  when 'partidas_no_mes' then
    select count(*)::int
      into v_medida
      from public.match_results r
     where r.status = 'confirmado'
       and (p_user_id = any(r.vencedores) or p_user_id = any(r.perdedores))
       and r.confirmado_em >= date_trunc('month', now())
       and r.confirmado_em <  date_trunc('month', now()) + interval '1 month';

  -- ── NOVA ──────────────────────────────────────────────────────────────────
  -- A MAIOR sequência de semanas CONSECUTIVAS com jogo, dentro do mês corrente.
  --
  -- "Seguidas", não "quantas ao todo": jogar na 1ª e na 4ª semana dá 1, não 2.
  -- É o que o nome da medida promete, e é o que separa quem manteve o hábito
  -- de quem apareceu duas vezes.
  --
  -- A conta é o truque clássico de ilhas: dentro de uma sequência sem buraco,
  -- `semana - (n-ésima posição) * 1 semana` é constante, então agrupar por
  -- essa diferença separa cada sequência, e a maior contagem é a resposta.
  --
  -- Duas convenções, ditas por extenso porque mudam o resultado:
  --   • `date_trunc('week')` do Postgres começa na SEGUNDA-feira. Quem joga só
  --     aos domingos cai numa semana diferente de quem joga só aos sábados;
  --   • as semanas são recortadas pelo mês. Um mês começa e termina no meio de
  --     uma semana, então um mês tem 4 ou 5 semanas parciais. Com `minimo` 4,
  --     num mês de 5 semanas parciais a conquista não exige o mês inteiro — e
  --     está certo assim: exigir 5 tornaria a conquista mais difícil em uns
  --     meses que em outros, sem o jogador entender por quê.
  when 'semanas_seguidas_no_mes' then
    with semanas as (
      select distinct date_trunc('week', r.confirmado_em) as semana
        from public.match_results r
       where r.status = 'confirmado'
         and (p_user_id = any(r.vencedores) or p_user_id = any(r.perdedores))
         and r.confirmado_em >= date_trunc('month', now())
         and r.confirmado_em <  date_trunc('month', now()) + interval '1 month'
    ),
    ilhas as (
      select s.semana,
             s.semana - (row_number() over (order by s.semana)) * interval '1 week' as ilha
        from semanas s
    )
    select coalesce(max(t.tamanho), 0)::int
      into v_medida
      from (select count(*) as tamanho from ilhas group by ilhas.ilha) t;

  -- ── NOVA ──────────────────────────────────────────────────────────────────
  -- Em quantas temporadas FECHADAS o jogador terminou em primeiro.
  --
  -- `seasons.fechada` é o que torna o título definitivo: enquanto a temporada
  -- corre, a posição 1 muda a cada jogo de qualquer um, e conceder ali daria
  -- um selo permanente para quem liderou por uma tarde.
  --
  -- `rankings.posicao` é a posição GERAL da temporada, não por divisão — é
  -- assim que `confirmar_resultado()` e `rotina_temporada()` a calculam
  -- (`order by pontos desc, vitorias desc`, sem partição). Então este selo é
  -- do campeão da temporada inteira, um por temporada, e não de cada divisão.
  -- Se um dia a liga quiser campeão por divisão, é OUTRA medida — não um
  -- ajuste nesta.
  --
  -- Conta em vez de booleano de propósito: quem for bicampeão já tem o número
  -- pronto para um selo futuro de `minimo: 2`, sem medida nova.
  when 'temporadas_como_campeao' then
    select count(*)::int
      into v_medida
      from public.rankings k
      join public.seasons s on s.id = k.season_id
     where k.user_id = p_user_id
       and k.posicao = 1
       and s.fechada;

  else
    -- Regra que este motor não entende. NULL, e a concessão pula.
    v_medida := null;

  end case;

  return v_medida;
end
$fn$;

comment on function public.badge_medida(uuid, jsonb) is
  'Valor atual de uma medida de conquista para um jogador. Mede cinco coisas: sequencia_vitorias, estreia_divisao, partidas_no_mes, semanas_seguidas_no_mes e temporadas_como_campeao. Só mede: não concede e não escreve. NULL = tipo desconhecido, e nesse caso o motor nunca concede.';


-- ----------------------------------------------------------------------------
-- 3. GRANTS
-- ----------------------------------------------------------------------------
-- `create or replace` sobre uma função existente PRESERVA os privilégios que
-- ela já tinha — então, em tese, o revoke aplicado ontem continuaria valendo.
-- As linhas abaixo estão aqui assim mesmo, por duas razões: se a função tiver
-- sido derrubada e recriada no meio do caminho, ela renasce com EXECUTE para
-- PUBLIC; e porque "toda função que este arquivo toca sai dele com o grant
-- conferido" é uma regra mais fácil de auditar do que "depende".
--
-- Revoke de PUBLIC, não só de `anon`: `anon` é membro de PUBLIC, e revogar só
-- dele fecha a porta da frente e deixa a dos fundos aberta.
--
-- `authenticated` entra no revoke junto porque `badge_medida()` é peça interna:
-- quem a chama é `avaliar_badges()`, que roda como dono.
revoke execute on function public.badge_medida(uuid, jsonb) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 4. QUANDO CADA SELO SAI — leia antes de testar e estranhar
-- ----------------------------------------------------------------------------
-- STREAK SEMANAL: sai no gancho normal de `match_results`. O jogo que fecha a
-- quarta semana é um resultado confirmado, o gatilho adiado dispara, a medida
-- vale 4 e o selo sai na hora.
--
-- SELO DE CAMPEÃO: sai NO FECHAMENTO DA TEMPORADA, sem gatilho novo — e isso
-- não é sorte, é consequência de como `rotina_temporada()` funciona. Ela, na
-- MESMA transação:
--   1. calcula promoções e, para CADA jogador da temporada que acabou, faz
--      `insert into public.rankings` da linha da temporada nova;
--   2. recalcula `posicao` da temporada nova;
--   3. marca a temporada velha com `fechada = true`.
-- O passo 1 dispara `badges_ranking_inserido`. Como aquele gatilho é
-- `deferrable initially deferred`, ele só roda no COMMIT — quando o passo 3 já
-- aconteceu e a temporada já está fechada. A medida enxerga o título válido e
-- o selo sai junto com a notificação de promoção. Era exatamente para esse
-- tipo de ordem que o gatilho foi adiado.
--
-- O BURACO, que existe e é estreito: o passo 1 é um
-- `insert ... on conflict (season_id, user_id) do update`. Se o campeão JÁ
-- tiver linha na temporada nova (porque jogou antes de a rotina rodar), o
-- comando toma o caminho de UPDATE, e aí só dispara `badges_ranking_divisao`,
-- que é filtrado por mudança de `division_id`. Então o selo atrasa para o
-- próximo jogo confirmado quando as DUAS coisas valem ao mesmo tempo:
--   • o campeão já tinha linha na temporada nova; E
--   • ele não mudou de divisão — ou seja, é campeão dos Mestres (não há para
--     onde subir) ou tem menos de 3 jogos (a rotina não promove quem tem menos).
--
-- NÃO criei gatilho para cobrir isso. Um gatilho em `seasons` para quando
-- `fechada` vira true teria de varrer todos os jogadores daquela temporada, e
-- isso é mecanismo novo — a decisão é do orquestrador, não minha. Fica
-- registrado aqui como a alternativa, caso ele prefira fechar o buraco.
