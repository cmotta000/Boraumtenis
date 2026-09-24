-- ============================================================================
-- BADGES — o motor de conquistas
-- ============================================================================
-- As tabelas `badges` e `user_badges` existem desde o começo do projeto e
-- estão VAZIAS: ninguém nunca conquistou nada porque nunca houve quem
-- concedesse. Esta migration escreve esse "quem".
--
-- A ideia central, e é dela que sai todo o resto do arquivo: **um badge é um
-- dado, não é código.** Cada linha de `badges` carrega em `regra` (jsonb) a
-- descrição do que precisa acontecer, e o motor lê essa descrição. Acrescentar
-- uma conquista nova é, na esmagadora maioria dos casos, um INSERT — não uma
-- função nova, não um gatilho novo, não mexer no que já funciona.
--
-- O DESENHO PENSANDO NO QUE VEM DEPOIS. As próximas conquistas pedidas são
-- "jogou toda semana do mês" e "selo permanente de campeão da temporada X".
-- Nenhuma das duas deve exigir motor novo, então o motor foi quebrado em duas
-- peças com uma fronteira bem estreita:
--
--   • `badge_medida()` responde UMA pergunta: "quanto vale esta medida para
--     este jogador?" — devolve um número e mais nada;
--   • `avaliar_badges()` faz todo o resto, que é igual para toda conquista:
--     varrer o catálogo, comparar a medida com o `minimo` da regra, conceder
--     sem duplicar, e nunca conceder o que não entende.
--
-- Uma conquista nova é uma linha em `badges` mais, quando a medida ainda não
-- existir, UM `when` novo em `badge_medida()` devolvendo um inteiro. A
-- concessão, a idempotência, o gancho e a proteção do bloco 5 não são tocados.
-- Essa é a fronteira: se um dia alguém precisar mexer em `avaliar_badges()`
-- ou nos gatilhos para encaixar uma conquista, o desenho falhou.
--
-- O arquivo inteiro é idempotente: rodar duas vezes não dá erro, não duplica
-- badge e NÃO MOVE a data de conquista de ninguém. Não há DROP TABLE,
-- TRUNCATE nem DELETE de dado.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. A CHAVE QUE IMPEDE O BADGE EM DOBRO
-- ----------------------------------------------------------------------------
-- Conferido no banco antes de escrever: `user_badges` JÁ TEM
-- `PRIMARY KEY (user_id, badge_id)`. Então este bloco é um no-op hoje, e está
-- aqui só como rede — sem essa chave, o `on conflict` do bloco 4 não teria em
-- que se apoiar e a mesma conquista entraria duas vezes.
do $chave$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.user_badges'::regclass
       and contype = 'p'
  ) then
    alter table public.user_badges add primary key (user_id, badge_id);
  end if;
end
$chave$;


-- ----------------------------------------------------------------------------
-- 2. O CATÁLOGO
-- ----------------------------------------------------------------------------
-- Nove conquistas em três famílias. Os limiares são do orquestrador e são
-- EDITÁVEIS: o `on conflict (slug) do update` abaixo faz com que reaplicar
-- esta migration com outro número simplesmente atualize a regra.
--
-- ATENÇÃO ao editar um limiar para MAIS: quem já conquistou NÃO perde. A
-- linha em `user_badges` é um fato histórico ("em tal dia isto aconteceu"),
-- não uma avaliação contínua. Baixar um limiar concede para mais gente na
-- próxima avaliação; subir um limiar só afeta quem ainda não tem.
--
-- `regra` é o contrato com `badge_medida()`:
--   { "tipo": <nome da medida>, "minimo": <int>, ...parâmetros da medida }
-- `minimo` ausente vale 1.
insert into public.badges (slug, nome, descricao, icone, regra) values
  -- Família 1: sequência de vitórias.
  ('embalado', 'Embalado',
   'Três vitórias seguidas.',
   'flame',
   '{"tipo": "sequencia_vitorias", "minimo": 3}'::jsonb),

  ('pegando-fogo', 'Pegando fogo',
   'Cinco vitórias seguidas. A quadra está pegando fogo.',
   'zap',
   '{"tipo": "sequencia_vitorias", "minimo": 5}'::jsonb),

  -- Família 2: estreia em cada divisão. Uma linha por divisão — é o exemplo
  -- mais claro de "conquista nova = dado novo": as cinco usam a MESMA medida,
  -- mudando só o parâmetro.
  ('estreia-saibro', 'Estreia no Saibro',
   'Entrou na divisão onde todo mundo começa.',
   'medal',
   '{"tipo": "estreia_divisao", "division_id": 1}'::jsonb),

  ('estreia-rapida', 'Estreia na Quadra Rápida',
   'Subiu para a segunda divisão. O jogo ficou sério.',
   'medal',
   '{"tipo": "estreia_divisao", "division_id": 2}'::jsonb),

  ('estreia-grama', 'Estreia na Grama',
   'Chegou à terceira divisão. Poucos chegam aqui.',
   'medal',
   '{"tipo": "estreia_divisao", "division_id": 3}'::jsonb),

  ('estreia-central', 'Estreia na Quadra Central',
   'Chegou à quarta divisão. Luz, público, pressão.',
   'medal',
   '{"tipo": "estreia_divisao", "division_id": 4}'::jsonb),

  ('estreia-mestres', 'Estreia nos Mestres',
   'Chegou ao andar de cima.',
   'trophy',
   '{"tipo": "estreia_divisao", "division_id": 5}'::jsonb),

  -- Família 3: volume no mês corrente.
  ('frequente', 'Frequente',
   'Quatro partidas no mês.',
   'calendar-check',
   '{"tipo": "partidas_no_mes", "minimo": 4}'::jsonb),

  ('morador-da-quadra', 'Morador da quadra',
   'Dez partidas no mês. Alguém aí tem casa?',
   'house',
   '{"tipo": "partidas_no_mes", "minimo": 10}'::jsonb)

on conflict (slug) do update set
  nome      = excluded.nome,
  descricao = excluded.descricao,
  icone     = excluded.icone,
  regra     = excluded.regra;

comment on column public.badges.regra is
  'Contrato com badge_medida(): {"tipo": <medida>, "minimo": <int>, ...parâmetros}. minimo ausente vale 1. Tipo desconhecido NUNCA concede — o motor pula.';

comment on column public.badges.icone is
  'Nome do ícone lucide em kebab-case (flame, zap, medal, trophy, calendar-check, house). A tela traduz por um mapa fixo e cai num ícone genérico se não conhecer o nome — nunca monta componente a partir desta string.';


-- ----------------------------------------------------------------------------
-- 3. A MEDIDA — a única peça que cresce quando nasce conquista nova
-- ----------------------------------------------------------------------------
-- Recebe o jogador e uma regra, devolve UM inteiro: o valor atual daquela
-- medida para aquele jogador. Não concede nada, não escreve nada, não decide
-- nada. Quem compara com o `minimo` é o bloco 4.
--
-- NULL tem significado: "não sei medir isto". Tipo de regra desconhecido cai
-- no `else` e devolve NULL, e o motor pula a conquista. É deliberado que o
-- caminho do desconhecido seja NÃO CONCEDER — um erro de digitação em `tipo`
-- tem que produzir um badge que ninguém ganha, nunca um badge que todo mundo
-- ganha.
--
-- PARA ACRESCENTAR UMA MEDIDA (ex.: as duas que já estão encomendadas):
--   'semanas_seguidas_no_mes' -> contar as semanas do mês corrente com pelo
--       menos um resultado confirmado; `minimo` seria 4.
--   'temporadas_como_campeao' -> contar em quantas temporadas fechadas o
--       jogador terminou na posição 1 de `rankings`; `minimo` 1, e o selo
--       fica permanente de graça, porque `user_badges` nunca é apagado.
-- Nos dois casos é um `when` novo aqui e uma linha no bloco 2. Nada mais.
create or replace function public.badge_medida(p_user_id uuid, p_regra jsonb)
returns int
language plpgsql
stable
security definer
-- search_path fixo: numa função SECURITY DEFINER, um search_path vindo de fora
-- escolheria qual `match_results` é `match_results`. `pg_temp` no fim pela
-- mesma razão.
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
  -- esbarrar na primeira derrota.
  --
  -- É a sequência CORRENTE, não a melhor da vida — e isso basta: o motor roda
  -- depois de todo resultado confirmado, então no instante em que a terceira
  -- vitória seguida entra, a sequência corrente vale 3 e o badge é concedido.
  -- Como `user_badges` nunca é apagado, perder o jogo seguinte não tira a
  -- conquista. Guardar "a melhor sequência histórica" daria o mesmo resultado
  -- por um caminho mais caro.
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
     -- Sem derrota nenhuma, todos os jogos contam. Se o jogo mais recente foi
     -- derrota, a primeira derrota está em rn = 1 e a conta dá zero.
     where j.rn < coalesce((select min(d.rn) from jogos d where not d.venceu), 2147483647);

  -- Já esteve alguma vez nesta divisão? 1 = sim, 0 = ainda não.
  -- Medida binária de propósito: o `minimo` padrão (1) resolve, e a família
  -- inteira das cinco divisões cabe numa medida só, mudando o parâmetro.
  when 'estreia_divisao' then
    select case when exists (
             select 1
               from public.rankings k
              where k.user_id = p_user_id
                and k.division_id = (p_regra->>'division_id')::smallint
           ) then 1 else 0 end
      into v_medida;

  -- Partidas confirmadas no MÊS CORRENTE.
  --
  -- O corte de mês usa `now()` no fuso do servidor (UTC). Isso significa que,
  -- para quem joga tarde da noite no fim do mês em horário de Brasília, a
  -- partida pode cair no mês seguinte da contagem. É uma imprecisão conhecida
  -- e aceita: o alternativo seria carregar o fuso de cada jogador, que o
  -- projeto não tem, para mover a conquista em no máximo um dia.
  when 'partidas_no_mes' then
    select count(*)::int
      into v_medida
      from public.match_results r
     where r.status = 'confirmado'
       and (p_user_id = any(r.vencedores) or p_user_id = any(r.perdedores))
       and r.confirmado_em >= date_trunc('month', now())
       and r.confirmado_em <  date_trunc('month', now()) + interval '1 month';

  else
    -- Regra que este motor não entende. NULL, e o bloco 4 pula.
    v_medida := null;

  end case;

  return v_medida;
end
$fn$;

comment on function public.badge_medida(uuid, jsonb) is
  'Valor atual de uma medida de conquista para um jogador. Só mede: não concede e não escreve. NULL = tipo de regra desconhecido, e nesse caso o motor nunca concede.';


-- ----------------------------------------------------------------------------
-- 4. A CONCESSÃO — genérica, e é a parte que não muda mais
-- ----------------------------------------------------------------------------
-- Varre o catálogo, mede, compara, concede. Devolve quantas conquistas novas
-- saíram (útil para log e para um backfill manual saber se fez algo).
--
-- IDEMPOTÊNCIA, em duas camadas que se sobrepõem de propósito:
--   1. o `not exists` do próprio SELECT já ignora o que o jogador tem. É o que
--      garante que `conquistado_em` NUNCA se mexe: uma conquista já obtida
--      sequer é medida de novo, então não há UPDATE possível;
--   2. o `on conflict (user_id, badge_id) do nothing` no insert cobre a
--      corrida — dois resultados confirmados no mesmo instante avaliando o
--      mesmo jogador. Sem ele, um dos dois levaria erro de chave duplicada.
-- Rodar o motor mil vezes seguidas produz exatamente o mesmo estado.
create or replace function public.avaliar_badges(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  b        record;
  v_medida int;
  v_minimo int;
  v_novos  int := 0;
begin
  if p_user_id is null then
    return 0;
  end if;

  for b in
    select bg.id, bg.slug, bg.regra
      from public.badges bg
     where bg.regra is not null
       and not exists (
             select 1
               from public.user_badges ub
              where ub.user_id  = p_user_id
                and ub.badge_id = bg.id
           )
  loop
    v_minimo := coalesce((b.regra->>'minimo')::int, 1);
    v_medida := public.badge_medida(p_user_id, b.regra);

    -- `v_medida is not null` é a guarda do tipo desconhecido. Não junte as
    -- duas condições num `coalesce(v_medida, 0) >= v_minimo`: com `minimo`
    -- zero isso concederia a conquista que o motor não sabe medir.
    if v_medida is not null and v_medida >= v_minimo then
      insert into public.user_badges (user_id, badge_id)
      values (p_user_id, b.id)
      on conflict (user_id, badge_id) do nothing;

      if found then
        v_novos := v_novos + 1;
      end if;
    end if;
  end loop;

  return v_novos;
end
$fn$;

comment on function public.avaliar_badges(uuid) is
  'Concede ao jogador toda conquista cujo limiar ele já atingiu. Idempotente: nunca duplica e nunca move conquistado_em. Devolve quantas saíram.';


-- ----------------------------------------------------------------------------
-- 5. A PROTEÇÃO — conceder badge NÃO PODE derrubar a confirmação do placar
-- ----------------------------------------------------------------------------
-- Esta é a regra mais importante do arquivo, então vale explicar o mecanismo
-- inteiro.
--
-- O PROBLEMA: `confirmar_resultado()` roda numa transação só. O gatilho do
-- bloco 6 roda DENTRO dessa mesma transação. Em Postgres não existe "erro
-- parcial": qualquer exceção não tratada aborta a transação inteira. Se o
-- motor de badges estourasse — divisão por zero numa regra nova, tipo errado
-- num jsonb editado à mão, deadlock — o jogador perderia o placar que acabou
-- de confirmar. Um enfeite derrubaria o registro do jogo. Inaceitável.
--
-- A SOLUÇÃO: esta função, e só ela, é o que os gatilhos chamam. O bloco
-- `exception` do plpgsql abre uma SUBTRANSAÇÃO em volta do corpo. Se o motor
-- estourar, só o que ELE fez é desfeito; o `raise warning` registra no log e a
-- execução segue normalmente. A transação de fora — placar confirmado, ELO,
-- pontos, ranking, post, notificações — chega inteira ao commit.
--
-- O QUE ISSO CUSTA, dito por extenso: uma falha no motor é SILENCIOSA para o
-- jogador. Ele confirma o placar, tudo funciona, e o badge simplesmente não
-- vem. Fica no log do servidor como warning. É a troca certa (placar vale mais
-- que badge), mas quem for investigar "por que fulano não ganhou o selo"
-- precisa saber que o lugar de olhar é o log, não a tela.
--
-- O QUE ISSO **NÃO** COBRE: falha que não vira exceção capturável — estouro de
-- memória, o processo ser morto, `statement_timeout` derrubando a sessão
-- inteira. Nesses casos a transação cai junto de qualquer jeito. Não há
-- proteção possível dentro da mesma transação; a alternativa seria uma fila
-- assíncrona, que este projeto não tem e que não se justifica por um selo.
create or replace function public.avaliar_badges_seguro(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  perform public.avaliar_badges(p_user_id);
exception
  when others then
    -- WARNING, não EXCEPTION: warning informa e segue; exception derrubaria
    -- exatamente o que este bloco existe para proteger.
    raise warning 'motor de badges falhou para o jogador % — % (SQLSTATE %)',
      p_user_id, sqlerrm, sqlstate;
end
$fn$;

comment on function public.avaliar_badges_seguro(uuid) is
  'Única porta que os gatilhos usam. Engole qualquer erro do motor (subtransação + raise warning) para que uma falha ao conceder badge jamais derrube a confirmação de um resultado.';


-- ----------------------------------------------------------------------------
-- 6. OS GANCHOS
-- ----------------------------------------------------------------------------
-- Gatilho, e não uma chamada dentro de `confirmar_resultado()`, por uma razão
-- prática: encaixar a chamada lá dentro obrigaria a reescrever aquela função
-- inteira (100 linhas de ELO, ranking e notificação) neste arquivo, e as duas
-- cópias divergiriam no dia em que alguém mexesse numa delas. O gatilho
-- pendura o motor sem tocar uma linha do que já funciona.
--
-- POR QUE `constraint trigger ... initially deferred` E NÃO UM AFTER COMUM:
-- um AFTER FOR EACH ROW comum dispara no fim do COMANDO. Na prática, ele
-- rodaria logo depois do `update match_results set status='confirmado'` e
-- ANTES de `confirmar_resultado()` chegar a mexer em `rankings` — a medida
-- `estreia_divisao` leria um ranking que ainda não existe e a estreia sairia
-- um jogo atrasada. Adiado para o commit, o motor enxerga a transação pronta.
--
-- Detalhe do `when` em gatilho de constraint: a condição é avaliada na hora em
-- que a linha muda, e o corpo só no commit. É exatamente o que se quer aqui —
-- filtrar pela TRANSIÇÃO (virou confirmado agora) e medir com o estado FINAL.

-- Os dois corpos de gatilho vêm primeiro, porque `create trigger` exige que a
-- função já exista. São finos de propósito: só descobrem DE QUEM é a
-- avaliação e delegam para a porta protegida do bloco 5. Nenhuma regra mora
-- aqui.
create or replace function public.badges_apos_resultado()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  u uuid;
begin
  -- Os dois lados: perder também conta (partidas no mês), e a derrota é o que
  -- encerra a sequência de quem vinha embalado.
  foreach u in array coalesce(new.vencedores, '{}'::uuid[]) loop
    perform public.avaliar_badges_seguro(u);
  end loop;

  foreach u in array coalesce(new.perdedores, '{}'::uuid[]) loop
    perform public.avaliar_badges_seguro(u);
  end loop;

  return null;   -- AFTER trigger: o valor de retorno é ignorado
end
$fn$;

create or replace function public.badges_apos_ranking()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
begin
  perform public.avaliar_badges_seguro(new.user_id);
  return null;
end
$fn$;

comment on function public.badges_apos_resultado() is
  'Gatilho adiado em match_results: avalia badges dos dois lados quando um resultado vira confirmado. Delega para avaliar_badges_seguro().';

comment on function public.badges_apos_ranking() is
  'Gatilho adiado em rankings: avalia badges quando o jogador entra na tabela ou muda de divisão. É o que faz a conquista de estreia sair na hora certa.';


-- 6a. Resultado confirmado — o gancho principal.
drop trigger if exists badges_resultado_inserido on public.match_results;
create constraint trigger badges_resultado_inserido
  after insert on public.match_results
  deferrable initially deferred
  for each row
  when (new.status = 'confirmado')
  execute function public.badges_apos_resultado();

drop trigger if exists badges_resultado_confirmado on public.match_results;
create constraint trigger badges_resultado_confirmado
  after update on public.match_results
  deferrable initially deferred
  for each row
  -- `is distinct from` e não `<>`: com status nulo, `<>` seria NULL e o
  -- gatilho não dispararia.
  when (old.status is distinct from 'confirmado' and new.status = 'confirmado')
  execute function public.badges_apos_resultado();

-- 6b. Mudança de divisão — o gancho que o enunciado não pediu, e que a
-- conquista de estreia precisa para não sair errada.
--
-- Quem promove e rebaixa NÃO é `confirmar_resultado()`: é
-- `rotina_temporada()`, que roda no virar da temporada. Sem este segundo
-- gatilho, a estreia nas divisões 2 a 5 só seria percebida no próximo
-- resultado confirmado depois da promoção — o jogador subiria de divisão e o
-- selo chegaria dias depois, sem relação visível com o que aconteceu.
-- Pendurar em `rankings` cobre os dois caminhos (a primeira linha do jogador e
-- toda promoção posterior) sem reescrever `rotina_temporada()` também.
drop trigger if exists badges_ranking_inserido on public.rankings;
create constraint trigger badges_ranking_inserido
  after insert on public.rankings
  deferrable initially deferred
  for each row
  execute function public.badges_apos_ranking();

drop trigger if exists badges_ranking_divisao on public.rankings;
create constraint trigger badges_ranking_divisao
  after update on public.rankings
  deferrable initially deferred
  for each row
  when (old.division_id is distinct from new.division_id)
  execute function public.badges_apos_ranking();


-- ----------------------------------------------------------------------------
-- 7. QUEM PODE LER O QUÊ
-- ----------------------------------------------------------------------------
-- DOIS PROBLEMAS ENCONTRADOS NO ESTADO ATUAL DO BANCO, os dois corrigidos aqui:
--
--   1. a policy `user_badges_select` estava com `using (true)`. Com a tabela
--      vazia isso nunca vazou nada, mas no instante em que o motor deste
--      arquivo começasse a conceder, QUALQUER pessoa logada leria as
--      conquistas de QUALQUER outra — inclusive de quem fechou o perfil.
--      Passa a ser só a própria linha; terceiro sai pela RPC do bloco 8.
--
--   2. `anon` e `authenticated` tinham ALL nas duas tabelas (os default
--      privileges do Supabase para tabelas novas em `public`). Isso inclui
--      TRUNCATE, que **RLS não protege** — RLS filtra linha, e TRUNCATE não
--      olha linha nenhuma. Qualquer pessoa logada podia esvaziar o catálogo de
--      conquistas e o histórico de todo mundo. É o mesmo motivo que fez
--      20260913_atividades.sql começar por um `revoke all`.
alter table public.badges      enable row level security;
alter table public.user_badges enable row level security;

-- O catálogo é público para quem está logado: é a lista do que dá para
-- conquistar, e esconder isso só tornaria o jogo pior.
drop policy if exists badges_select on public.badges;
create policy badges_select on public.badges
  for select to authenticated
  using (true);

-- O histórico, não. Só o dono alcança a própria linha por acesso direto.
drop policy if exists user_badges_select on public.user_badges;
create policy user_badges_select on public.user_badges
  for select to authenticated
  using (auth.uid() = user_id);

-- Não existe policy de INSERT/UPDATE/DELETE para `authenticated` em nenhuma
-- das duas, e a ausência é a decisão: conquista é concedida pelo motor (que é
-- SECURITY DEFINER e não passa por RLS), nunca pelo cliente. Sem isso, dar-se
-- um troféu seria um POST.
revoke all on public.badges      from anon, authenticated;
revoke all on public.user_badges from anon, authenticated;

grant select on public.badges      to authenticated;
grant select on public.user_badges to authenticated;


-- ----------------------------------------------------------------------------
-- 8. A PORTA DE SAÍDA DAS CONQUISTAS DE OUTRA PESSOA
-- ----------------------------------------------------------------------------
-- Conquista é feita para mostrar — mas, como tudo neste projeto, quem decide
-- para quem é o banco, não a tela. A regra do AGENTS.md vale aqui igual: o
-- perfil de terceiro entra pela view mascarada `public.perfis`, nunca pela
-- tabela `public.profiles`. É por `perfis` que esta função entra no assunto,
-- e é `pode_ver_perfil()` que decide se a lista sai.
--
-- Para o próprio dono sai sempre, mesmo com o perfil fechado: perfil privado
-- é privado para os outros, não para si.
create or replace function public.badges_do_perfil(p_user_id uuid)
returns table (
  slug           text,
  nome           text,
  descricao      text,
  icone          text,
  conquistado_em timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $fn$
  select bg.slug,
         bg.nome,
         bg.descricao,
         bg.icone,
         ub.conquistado_em
    from public.perfis pr
    join public.user_badges ub on ub.user_id  = pr.id
    join public.badges      bg on bg.id       = ub.badge_id
   where auth.uid() is not null
     and pr.id = p_user_id
     and (pr.id = auth.uid() or public.pode_ver_perfil(pr.id))
   order by ub.conquistado_em desc, bg.slug;
$fn$;

comment on function public.badges_do_perfil(uuid) is
  'Conquistas de um jogador. Do próprio dono sempre; de terceiro só sob pode_ver_perfil(). Entra pela view public.perfis, nunca pela tabela profiles.';


-- ----------------------------------------------------------------------------
-- 9. GRANTS DAS FUNÇÕES
-- ----------------------------------------------------------------------------
-- O `revoke` vem antes do `grant` e tira de PUBLIC — não só de `anon`.
-- O Postgres concede EXECUTE a PUBLIC em toda função nova, e `anon` é membro
-- de PUBLIC como todo mundo: revogar só de `anon` fecha a porta da frente e
-- deixa a dos fundos aberta. Este projeto já teve seis funções nessa situação.
-- `anon` aparece junto por explicitude, não por necessidade.

-- As peças internas do motor não são de ninguém de fora. `authenticated` entra
-- no revoke junto: os gatilhos rodam como o dono da função (SECURITY DEFINER),
-- então nada aqui precisa de EXECUTE concedido a um papel de usuário. Deixar
-- concedido só permitiria disparar avaliação em nome de terceiros à toa.
revoke execute on function public.badge_medida(uuid, jsonb)      from public, anon, authenticated;
revoke execute on function public.avaliar_badges(uuid)           from public, anon, authenticated;
revoke execute on function public.avaliar_badges_seguro(uuid)    from public, anon, authenticated;
revoke execute on function public.badges_apos_resultado()        from public, anon, authenticated;
revoke execute on function public.badges_apos_ranking()          from public, anon, authenticated;

-- A única que a interface chama.
revoke execute on function public.badges_do_perfil(uuid) from public, anon;
grant  execute on function public.badges_do_perfil(uuid) to authenticated;
