-- ============================================================================
-- BADGES — campeão DA DIVISÃO, e a temporada que não vale título
-- ============================================================================
-- O selo de campeão é por DIVISÃO, não geral. A razão é de produto e é boa:
-- `rankings.posicao` é a posição geral da temporada, então o jogador do Saibro
-- disputaria o primeiro lugar contra os Mestres e nunca chegaria lá. Selo
-- inalcançável para a maior parte da base não retém ninguém — vira enfeite de
-- quem já estava ganhando.
--
-- Mas "terminou em primeiro na divisão" não basta sozinho para ser título. Dois
-- jeitos de isso sair errado, e este arquivo trata os dois:
--
--   • TEMPORADA QUE NINGUÉM JOGOU. Existe uma temporada `fechada = true` que
--     nunca foi disputada: a "Temporada 2026" anual, aposentada quando a liga
--     virou trimestral. Ela tem primeiro colocado. Sem tratar isso, o selo
--     nasceria permanente na mão de quem não ganhou nada. Bloco 1.
--   • DIVISÃO SEM DISPUTA. Ser o primeiro de uma divisão com uma pessoa só, ou
--     ter levantado o troféu com dois jogos, não é campeonato. Bloco 3.
--
-- A medida geral `temporadas_como_campeao` CONTINUA na função, agora também
-- filtrada por temporada que vale título. Ela segue sem badge apontando para
-- ela — é reserva para um eventual selo raro de campeão geral.
--
-- Idempotente: rodar duas vezes não dá erro, não duplica badge, não move data
-- de conquista e não remarca temporada que alguém tenha ajustado à mão.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. QUAIS TEMPORADAS VALEM TÍTULO
-- ----------------------------------------------------------------------------
-- Escolhi MARCA NO REGISTRO em vez de filtro por data na consulta, e defendo:
--
-- um filtro do tipo "só temporadas que começaram depois de tal dia" resolve o
-- caso de hoje e mente amanhã. A "Temporada 2026" começa em 01/01 e a
-- trimestral T3 começa em 01/07 — as duas antes da liga existir —, então
-- nenhuma data de corte separa as duas sem ser arbitrária. Pior: o critério
-- ficaria escondido dentro de uma função, invisível para quem for olhar a
-- tabela de temporadas tentando entender por que fulano não ganhou o selo.
--
-- Uma coluna resolve os dois problemas: o critério fica VISÍVEL no registro, e
-- uma exceção futura (uma temporada cancelada no meio, um teste que vazou para
-- produção) é um UPDATE de uma linha em vez de mais um `and` na função.
--
-- O preenchimento inicial usa duração, que é o que de fato distingue os dois
-- modelos neste banco: a temporada aposentada tem 364 dias, a trimestral tem
-- 91. O corte em 120 dias fica longe das duas pontas. Temporada nova nasce
-- valendo título, pelo default.
do $marca_titulo$
begin
  -- O `if not exists` faz o preenchimento acontecer UMA VEZ, na criação da
  -- coluna. Sem isso, reaplicar a migration voltaria a marcar como "não vale"
  -- uma temporada longa que alguém tenha liberado à mão depois.
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name   = 'seasons'
       and column_name  = 'vale_titulo'
  ) then
    alter table public.seasons
      add column vale_titulo boolean not null default true;

    update public.seasons
       set vale_titulo = false
     where (fim - inicio) > 120;
  end if;
end
$marca_titulo$;

comment on column public.seasons.vale_titulo is
  'Se esta temporada pode gerar selo de campeão. false para temporada que existiu mas não foi disputada — hoje, a anual de 2026, aposentada quando a liga virou trimestral. Preenchida uma vez por duração (>120 dias = modelo antigo); daqui pra frente é decisão humana, um UPDATE por linha. Temporada nova nasce true.';


-- ----------------------------------------------------------------------------
-- 2. A CONQUISTA
-- ----------------------------------------------------------------------------
insert into public.badges (slug, nome, descricao, icone, regra) values
  ('campeao-da-divisao', 'Campeão da divisão',
   'Terminou uma temporada em primeiro lugar na sua divisão.',
   'crown',
   '{"tipo": "temporadas_como_campeao_divisao", "minimo": 1}'::jsonb)

on conflict (slug) do update set
  nome      = excluded.nome,
  descricao = excluded.descricao,
  icone     = excluded.icone,
  regra     = excluded.regra;


-- ----------------------------------------------------------------------------
-- 3. badge_medida() — as cinco de antes, mais a de campeão por divisão
-- ----------------------------------------------------------------------------
-- Duas coisas mudam nesta versão, e só duas:
--   • entra o `when 'temporadas_como_campeao_divisao'`;
--   • o `when 'temporadas_como_campeao'` (geral) ganha o filtro
--     `s.vale_titulo`, pela mesma razão do bloco 1 — não custa nada hoje,
--     porque não há badge apontando para ela, e evita que quem semear esse
--     badge no futuro herde a armadilha.
-- As outras quatro medidas estão idênticas.
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

  -- Vitórias seguidas AGORA, do jogo mais recente para trás até a primeira
  -- derrota. Sequência corrente basta: o motor roda a cada confirmação, e
  -- `user_badges` nunca é apagado, então perder depois não tira o selo.
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

  -- Partidas confirmadas no mês corrente. Corte em `now()` no fuso do servidor
  -- (UTC) — imprecisão conhecida e aceita, detalhada em 20260923_badges.sql.
  when 'partidas_no_mes' then
    select count(*)::int
      into v_medida
      from public.match_results r
     where r.status = 'confirmado'
       and (p_user_id = any(r.vencedores) or p_user_id = any(r.perdedores))
       and r.confirmado_em >= date_trunc('month', now())
       and r.confirmado_em <  date_trunc('month', now()) + interval '1 month';

  -- Maior sequência de semanas CONSECUTIVAS com jogo dentro do mês corrente
  -- (truque de ilhas). Semana começa na segunda, e as semanas são recortadas
  -- pelo mês — as duas convenções estão explicadas em
  -- 20260924_badges_novas_regras.sql.
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

  -- Campeão GERAL da temporada. Sem badge apontando para ela hoje; fica de
  -- reserva. Ganhou `s.vale_titulo` nesta versão.
  when 'temporadas_como_campeao' then
    select count(*)::int
      into v_medida
      from public.rankings k
      join public.seasons s on s.id = k.season_id
     where k.user_id = p_user_id
       and k.posicao = 1
       and s.fechada
       and s.vale_titulo;

  -- ── NOVA ──────────────────────────────────────────────────────────────────
  -- Em quantas temporadas fechadas o jogador terminou em primeiro DENTRO DA
  -- PRÓPRIA DIVISÃO.
  --
  -- `rankings.posicao` não serve: é a posição geral da temporada. A posição por
  -- divisão precisa ser derivada, e a ordenação abaixo é COPIADA DE
  -- `rotina_temporada()` — conferida lendo a função, não presumida:
  --
  --     row_number() over (partition by rk.division_id
  --                        order by rk.pontos desc, rk.vitorias desc,
  --                                 rk.derrotas asc, rk.user_id)
  --
  -- São QUATRO critérios, não dois. Copiar todos importa: é a mesma conta que
  -- decide quem sobe de divisão, então o campeão da divisão é necessariamente
  -- quem foi promovido. Se as duas ordenações divergirem, o app vai promover
  -- uma pessoa e dar o troféu para outra.
  --
  -- (O quarto critério é `user_id`, que é desempate por uuid — feio, mas
  -- determinístico, e é o que a promoção já usa. Trocar o desempate é mudança
  -- na liga, não no motor de badges: teria de mudar nos dois lugares juntos.)
  --
  -- A janela roda sobre TODAS as linhas da divisão, e só depois filtra pelo
  -- jogador. Filtrar antes daria posição 1 para qualquer um, sempre.
  --
  -- Dois guardas contra "título" que não foi disputa:
  --   • `jogos >= 3`, o MESMO mínimo que `rotina_temporada()` exige para
  --     promover (`if r.jogos >= 3 then`). Levantar troféu com dois jogos não
  --     é campeonato, e usar outro número aqui criaria o caso absurdo do
  --     campeão que não sobe de divisão;
  --   • pelo menos 2 participantes na divisão. Ser o primeiro de uma divisão
  --     de uma pessoa é ser o único.
  --
  -- Se um dia isso parecer frouxo, o aperto natural é exigir 2 participantes
  -- COM 3+ jogos em vez de 2 participantes quaisquer — é trocar o `count(*)`
  -- por um `count(*) filter (where k.jogos >= 3)`.
  when 'temporadas_como_campeao_divisao' then
    with disputadas as (
      select k.user_id,
             k.jogos,
             row_number() over (
               partition by k.season_id, k.division_id
               order by k.pontos desc, k.vitorias desc, k.derrotas asc, k.user_id
             ) as posicao_na_divisao,
             count(*) over (partition by k.season_id, k.division_id) as na_divisao
        from public.rankings k
        join public.seasons s on s.id = k.season_id
       where s.fechada
         and s.vale_titulo
    )
    select count(*)::int
      into v_medida
      from disputadas d
     where d.user_id           = p_user_id
       and d.posicao_na_divisao = 1
       and d.na_divisao        >= 2
       and d.jogos             >= 3;

  else
    -- Regra que este motor não entende. NULL, e a concessão pula.
    v_medida := null;

  end case;

  return v_medida;
end
$fn$;

comment on function public.badge_medida(uuid, jsonb) is
  'Valor atual de uma medida de conquista para um jogador. Mede seis coisas: sequencia_vitorias, estreia_divisao, partidas_no_mes, semanas_seguidas_no_mes, temporadas_como_campeao (geral, sem badge) e temporadas_como_campeao_divisao. Só mede: não concede e não escreve. NULL = tipo desconhecido, e nesse caso o motor nunca concede.';


-- ----------------------------------------------------------------------------
-- 4. GRANTS
-- ----------------------------------------------------------------------------
-- `create or replace` preserva os privilégios que a função já tinha, mas a
-- linha fica aqui assim mesmo: se em algum momento a função tiver sido
-- derrubada e recriada, ela renasce com EXECUTE para PUBLIC, e "toda função
-- que este arquivo toca sai dele com o grant conferido" é mais fácil de
-- auditar do que "depende".
--
-- Revoke de PUBLIC, não só de `anon`: `anon` é membro de PUBLIC, e revogar só
-- dele fecha a porta da frente e deixa a dos fundos aberta. `authenticated`
-- entra junto porque `badge_medida()` é peça interna — quem chama é
-- `avaliar_badges()`, que roda como dono.
revoke execute on function public.badge_medida(uuid, jsonb) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. QUANDO O SELO SAI
-- ----------------------------------------------------------------------------
-- Igual ao que já foi descrito para o selo geral: no FECHAMENTO da temporada,
-- sem gatilho novo. `rotina_temporada()` insere, na mesma transação, a linha da
-- temporada nova para cada jogador da que acabou; isso dispara
-- `badges_ranking_inserido`, que é `deferrable initially deferred` e só roda no
-- commit — quando a temporada velha já está com `fechada = true`.
--
-- E aqui a coincidência ajuda mais do que no selo geral: o campeão de uma
-- divisão que não é a última é exatamente quem a rotina PROMOVE, e promoção
-- muda `division_id`, o que dispara também `badges_ranking_divisao`. Os dois
-- caminhos levam ao mesmo lugar.
--
-- O buraco estreito continua o mesmo de antes: campeão que já tinha linha na
-- temporada nova E que não muda de divisão (campeão dos Mestres, ou com menos
-- de 3 jogos — que aqui nem título tem). Nesse caso o selo espera o próximo
-- jogo confirmado. Fechar isso exigiria um gatilho em `seasons`, que é
-- mecanismo novo e decisão do orquestrador.
