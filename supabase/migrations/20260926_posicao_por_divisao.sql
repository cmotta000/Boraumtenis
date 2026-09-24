-- ============================================================================
-- LIGA — `rankings.posicao` passa a ser POR DIVISÃO, com os quatro critérios
-- ============================================================================
-- O QUE ESTAVA ERRADO, e é mais do que a não-determinação do empate:
--
-- `posicao` é escrita em dois lugares (`confirmar_resultado` e
-- `rotina_temporada`), nos dois como `row_number() over (order by pontos desc,
-- vitorias desc)` — geral, dois critérios, sem desempate final. Já quem LÊ,
-- lê outra coisa: `liga_classificacao()` e `minha_liga()` calculam o próprio
-- `rn` particionado por divisão e com QUATRO critérios (pontos desc, vitorias
-- desc, derrotas asc, user_id). São duas escalas diferentes convivendo.
--
-- E elas se encontram no pior lugar possível. `minha_liga()` faz:
--
--     v_pos     := row_number() ... por divisão, 4 critérios   (calculado)
--     v_pos_ant := rk.posicao_anterior                          (lido da tabela)
--     tendencia := liga_tendencia(v_pos, v_pos_ant, ...)
--
-- ou seja, a seta de tendência JÁ COMPARA uma posição por divisão contra uma
-- posição geral. Hoje ninguém percebe porque todo mundo está na divisão 1, e
-- aí as duas escalas coincidem. Com duas divisões povoadas, o primeiro do
-- Saibro passaria a ver "subindo" para sempre — ele é 1º na divisão e era 40º
-- no geral. A não-determinação do empate é um segundo defeito, real e menor.
--
-- A TELA NÃO ESTÁ ERRADA: o leaderboard não usa esta coluna, `liga_classificacao()`
-- calcula a própria posição e está certo e determinístico. Quem consome
-- `posicao`/`posicao_anterior` de verdade é a SETA DE TENDÊNCIA. É por ela que
-- esta migration existe, não pelo ranking.
--
-- A DECISÃO: `posicao` vira POR DIVISÃO. O argumento que decidiu não é estético
-- — é que todos os leitores já são por divisão. Manter geral e só acrescentar
-- os dois critérios que faltam consertaria o empate e DEIXARIA DE PÉ a
-- comparação entre coisas diferentes, que é o defeito que faz a seta mentir.
--
-- A CAUSA RAIZ é a ordenação estar copiada em vários lugares, então o conserto
-- centraliza: nasce `recalcular_posicoes()`, e os dois escritores passam a
-- chamá-la em vez de cada um carregar a sua cópia.
--
-- Idempotente, com um cuidado especial no bloco 1 — leia antes de reaplicar.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. O HISTÓRICO DE `posicao_anterior` — ⚠ ESTE BLOCO APAGA DADO
-- ----------------------------------------------------------------------------
-- ⚠ AVISO EXPLÍCITO: este bloco zera `rankings.posicao_anterior`. É a única
-- perda de dado do arquivo, é deliberada, e o orquestrador precisa concordar
-- com ela antes de aplicar.
--
-- POR QUÊ: os valores gravados ali estão na escala ANTIGA (posição geral, dois
-- critérios). Depois deste arquivo, `posicao` passa a ser por divisão. Deixar
-- o valor velho faria a seta comparar escalas diferentes no primeiro recálculo
-- — exatamente o defeito que viemos corrigir, só que agora com dado nosso.
--
-- POR QUE NULL E NÃO UM VALOR CONVERTIDO: não existe conversão honesta. Para
-- reconstruir a posição por divisão de ontem eu precisaria dos pontos,
-- vitórias e derrotas de ontem, e a tabela só guarda `pontos_anteriores` — um
-- escalar. Rankear por ele inventaria uma classificação que nunca existiu.
--
-- POR QUE NULL É SEGURO: `liga_tendencia()` já trata esse caso, e trata bem —
-- com `p_posicao_anterior is null` ela cai na comparação de pontos e devolve
-- 'subindo' se o jogador ganhou pontos, 'estavel' caso contrário. Ninguém vê
-- erro; vê uma seta neutra até o próximo jogo, que regrava o valor já na
-- escala nova. O estado se cura sozinho na primeira confirmação de placar.
--
-- IDEMPOTÊNCIA: o `if` abaixo usa a AUSÊNCIA de `recalcular_posicoes()` como
-- marca de "esta migration nunca rodou". Sem essa guarda, reaplicar o arquivo
-- apagaria valores novos e corretos, gravados por partidas posteriores. Por
-- isso este bloco vem ANTES de criar a função.
do $zera_anterior$
begin
  if to_regprocedure('public.recalcular_posicoes(uuid)') is null then
    update public.rankings
       set posicao_anterior = null
     where posicao_anterior is not null;

    raise notice
      'posicao_anterior zerada: os valores estavam na escala geral antiga. A seta de tendência fica neutra até o próximo placar confirmado.';
  end if;
end
$zera_anterior$;


-- ----------------------------------------------------------------------------
-- 2. A ORDENAÇÃO, AGORA NUM LUGAR SÓ
-- ----------------------------------------------------------------------------
-- Os quatro critérios são os de `rotina_temporada()`, copiados porque é ela
-- quem PROMOVE. Isso não é preferência: se o critério que ordena a tabela
-- divergir do que decide a promoção, o app promove uma pessoa e mostra outra
-- em primeiro. Os quatro, na ordem:
--
--   pontos desc      — o que o jogador acumulou na temporada;
--   vitorias desc    — mais vitórias com os mesmos pontos vem antes;
--   derrotas asc     — menos derrotas desempata a seguir;
--   user_id          — desempate final, arbitrário mas DETERMINÍSTICO.
--
-- O quarto é o que resolve o defeito do empate: sem ele, dois jogadores com
-- 13 pts / 0V / 0D (caso real na T3 de hoje) trocavam de lugar a cada
-- recálculo, sem nada ter acontecido, e a seta acusava queda. `user_id` é feio
-- como desempate, mas é estável, e trocá-lo agora seria mudar a regra de
-- promoção junto — decisão de liga, não de arrumação.
create or replace function public.recalcular_posicoes(p_season_id uuid)
returns void
language sql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  update public.rankings rk
     set posicao = ord.rn
    from (
      select k.user_id,
             row_number() over (
               partition by k.division_id
               order by k.pontos desc, k.vitorias desc, k.derrotas asc, k.user_id
             ) as rn
        from public.rankings k
       where k.season_id = p_season_id
    ) ord
   where ord.user_id   = rk.user_id
     and rk.season_id  = p_season_id;
$fn$;

comment on function public.recalcular_posicoes(uuid) is
  'Reescreve rankings.posicao de uma temporada. POR DIVISÃO, com os quatro critérios de desempate de rotina_temporada (pontos desc, vitorias desc, derrotas asc, user_id). Único lugar que ordena a tabela para gravação — confirmar_resultado e rotina_temporada chamam esta função em vez de repetir a conta.';

comment on column public.rankings.posicao is
  'Posição DENTRO DA DIVISÃO na temporada (não geral), mantida por recalcular_posicoes(). Mudou de sentido em 20260926: antes era geral. posicao_anterior guarda o valor anterior NA MESMA escala; quem comparar as duas tem que usar as duas.';


-- ----------------------------------------------------------------------------
-- 3. confirmar_resultado() — uma linha trocada
-- ----------------------------------------------------------------------------
-- A função é reescrita inteira porque `create or replace` não aceita remendo,
-- mas a ÚNICA diferença em relação ao que está no banco é o bloco final de
-- reordenação, que virou uma chamada:
--
--   ANTES:
--     with ord as (
--       select user_id, row_number() over (order by pontos desc, vitorias desc) as rn
--         from public.rankings where season_id = v_season
--     )
--     update public.rankings rk set posicao = ord.rn
--       from ord where ord.user_id = rk.user_id and rk.season_id = v_season;
--
--   DEPOIS:
--     perform public.recalcular_posicoes(v_season);
--
-- Todo o resto — validações, ELO, pontos, upsert em rankings, post e
-- notificações — está idêntico, inclusive o texto das mensagens de erro.
create or replace function public.confirmar_resultado(p_result_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  update public.match_results
     set status = 'confirmado', confirmado_por = v_me, confirmado_em = now(), pontos = v_pontos::smallint
   where id = p_result_id;

  update public.matches set status = 'jogada' where id = res.match_id;

  foreach u in array res.vencedores loop
    select p.elo_rating into v_elo_u from public.profiles p where p.id = u;
    v_elo_u := coalesce(v_elo_u, 1200);

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

    update public.profiles
       set derrotas = derrotas + 1,
           elo_rating = greatest(100, elo_rating + v_delta_perd)
     where id = u;
  end loop;

  -- ÚNICA MUDANÇA DESTA FUNÇÃO. Era um `with ord as (...) update ...` com a
  -- ordenação geral de dois critérios; agora é a função central do bloco 2.
  perform public.recalcular_posicoes(v_season);

  insert into public.posts (user_id, tipo, result_id, match_id, legenda, fotos)
  values (res.reporter_id, 'resultado', res.id, res.match_id, res.legenda, coalesce(res.fotos, '{}'))
  on conflict (result_id) do nothing;

  for r in select * from public.participantes_partida(res.match_id, v_me) loop
    perform public.criar_notificacao(r.user_id, 'resultado_confirmado',
      jsonb_build_object('match_id', res.match_id, 'result_id', p_result_id, 'from_id', v_me));
  end loop;
end
$function$;


-- ----------------------------------------------------------------------------
-- 4. rotina_temporada() — a mesma linha trocada
-- ----------------------------------------------------------------------------
-- Idem: reescrita inteira, com uma única diferença de comportamento. O bloco
-- final de reordenação da temporada NOVA
--
--     with ord as (
--       select rk.user_id,
--              row_number() over (order by rk.pontos desc, rk.vitorias desc) as rn
--         from public.rankings rk where rk.season_id = v_new
--     )
--     update public.rankings rk set posicao = ord.rn
--       from ord where ord.user_id = rk.user_id and rk.season_id = v_new;
--
-- virou `perform public.recalcular_posicoes(v_new);`.
--
-- O `row_number()` do LOOP de promoção (o que tem `partition by rk.division_id`
-- e os quatro critérios) NÃO foi tocado: ele já estava certo, e é dele que os
-- quatro critérios foram copiados.
create or replace function public.rotina_temporada()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  select s.* into v_old
    from public.seasons s
   where s.fim < current_date and not s.fechada
   order by s.fim desc
   limit 1;

  if v_old.id is null then
    return;
  end if;

  update public.seasons s
     set fechada = true, ativa = false
   where s.fim < current_date and not s.fechada and s.id <> v_old.id;

  v_new := public.temporada_atual();
  if v_new = v_old.id then
    return;
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
        select d.id into v_destino from public.divisions d where d.ordem = r.ordem + 1;
      elsif r.ordem > 1
        and r.rn > (r.total - r.faixa)
        and r.rn > r.faixa then
        select d.id into v_destino from public.divisions d where d.ordem = r.ordem - 1;
      end if;
    end if;

    v_destino := coalesce(v_destino, r.division_id);
    v_carry := round(coalesce(r.pontos, 0) * 0.25)::int;

    select coalesce(p.elo_rating, 1200) into v_elo
      from public.profiles p where p.id = r.user_id;

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

  -- ÚNICA MUDANÇA DESTA FUNÇÃO.
  perform public.recalcular_posicoes(v_new);

  update public.seasons s
     set ativa = false, fechada = true
   where s.id = v_old.id;
end
$function$;


-- ----------------------------------------------------------------------------
-- 5. badge_medida() — consequência obrigatória, não escolha
-- ----------------------------------------------------------------------------
-- Mudar o SENTIDO de `posicao` quebra quem a lia esperando o sentido antigo, e
-- havia um leitor: a medida `temporadas_como_campeao` (a geral, sem badge)
-- usava `k.posicao = 1`. Com `posicao` virando por divisão, aquele `= 1`
-- passaria a significar "primeiro da própria divisão" — a medida geral viraria
-- silenciosamente uma cópia da medida por divisão, sem ninguém mexer nela.
--
-- Por isso ela passa a DERIVAR a posição geral, com uma janela sem partição.
-- De quebra ganha os quatro critérios, então também deixa de ser
-- não-determinística no empate.
--
-- As outras cinco medidas estão idênticas. `temporadas_como_campeao_divisao`
-- não precisou de nada: ela já derivava a própria posição e nunca leu a coluna.
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

  when 'estreia_divisao' then
    select case when exists (
             select 1
               from public.rankings k
              where k.user_id = p_user_id
                and k.division_id = (p_regra->>'division_id')::smallint
           ) then 1 else 0 end
      into v_medida;

  when 'partidas_no_mes' then
    select count(*)::int
      into v_medida
      from public.match_results r
     where r.status = 'confirmado'
       and (p_user_id = any(r.vencedores) or p_user_id = any(r.perdedores))
       and r.confirmado_em >= date_trunc('month', now())
       and r.confirmado_em <  date_trunc('month', now()) + interval '1 month';

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

  -- MUDOU: derivava de `k.posicao = 1`, agora calcula a posição geral. Sem
  -- badge apontando para ela; segue de reserva.
  when 'temporadas_como_campeao' then
    with gerais as (
      select k.user_id,
             row_number() over (
               partition by k.season_id
               order by k.pontos desc, k.vitorias desc, k.derrotas asc, k.user_id
             ) as posicao_geral
        from public.rankings k
        join public.seasons s on s.id = k.season_id
       where s.fechada
         and s.vale_titulo
    )
    select count(*)::int
      into v_medida
      from gerais g
     where g.user_id = p_user_id
       and g.posicao_geral = 1;

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
    v_medida := null;

  end case;

  return v_medida;
end
$fn$;


-- ----------------------------------------------------------------------------
-- 6. REALINHAR O QUE JÁ ESTÁ GRAVADO
-- ----------------------------------------------------------------------------
-- Reescreve `posicao` de TODAS as temporadas na escala nova, inclusive as
-- fechadas — senão a temporada de ontem continuaria em escala geral e a de
-- amanhã em escala por divisão, dentro da mesma coluna.
--
-- É seguro reaplicar: recalcular é uma função do estado atual, não um
-- incremento. Rodar dez vezes dá o mesmo resultado que rodar uma.
do $realinha$
declare
  s record;
begin
  for s in select id from public.seasons loop
    perform public.recalcular_posicoes(s.id);
  end loop;
end
$realinha$;


-- ----------------------------------------------------------------------------
-- 7. GRANTS
-- ----------------------------------------------------------------------------
-- `recalcular_posicoes()` é peça interna: quem chama são as duas funções
-- SECURITY DEFINER acima, que rodam como dono. Ninguém de fora precisa.
-- Revoke de PUBLIC, não só de `anon` — `anon` é membro de PUBLIC, e revogar só
-- dele fecha a porta da frente e deixa a dos fundos aberta.
revoke execute on function public.recalcular_posicoes(uuid) from public, anon, authenticated;

-- As três funções reescritas mantêm exatamente a ACL que já tinham no banco
-- (conferida antes de escrever este arquivo). `create or replace` preserva
-- privilégio, então estas linhas não mudam nada — estão aqui para o arquivo
-- ser autossuficiente se alguma delas for derrubada e recriada.
revoke execute on function public.badge_medida(uuid, jsonb)   from public, anon, authenticated;
revoke execute on function public.rotina_temporada()          from public, anon, authenticated;

revoke execute on function public.confirmar_resultado(uuid)   from public, anon;
grant  execute on function public.confirmar_resultado(uuid)   to authenticated;
