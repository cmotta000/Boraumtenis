-- ============================================================================
-- CONFRONTOS — retrospecto entre dois jogadores (head-to-head)
-- ============================================================================
-- A pergunta que falta responder é a que todo mundo faz antes de aceitar um
-- jogo: "eu já joguei com esse cara? como foi?". O dado para responder isso
-- já existe inteiro em `match_results` desde o primeiro placar registrado —
-- o que não existia era uma porta para ele. Nenhuma tabela nova nasce aqui:
-- este arquivo é só a porta.
--
-- O recorte é o par (eu, adversário) em partidas com resultado CONFIRMADO.
-- Pendente não conta porque ainda pode ser contestado, e contestado não conta
-- porque alguém já disse que está errado. Só `confirmado` — o mesmo valor do
-- enum `result_status` que o ranking usa para pontuar.
--
-- Duplas contam como confronto: o jogador está DENTRO dos arrays
-- `vencedores`/`perdedores`, então o teste é `= any(...)` e não `=`. Isso traz
-- de graça uma regra que seria fácil errar: quando os dois jogaram do MESMO
-- lado da rede, não houve confronto nenhum, e o par de condições cruzadas
-- abaixo descarta essa partida sozinho.
--
-- O arquivo inteiro é idempotente: rodar duas vezes não dá erro e não
-- duplica nada.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. PRIVACIDADE — o que esta função pode e o que ela não pode contar
-- ----------------------------------------------------------------------------
-- A regra do projeto é que quem aplica privacidade é o banco, nunca a tela.
-- Então vale escrever aqui, por extenso, de quem é cada coluna do retorno —
-- é isso que decide o que é mascarado:
--
--   • O PLACAR e a CONTA (quantos jogos, quantas vitórias, saldo de sets) são
--     dados do PAR. Eu estava nas duas pontas de cada uma dessas partidas, e
--     cada uma delas já se abre para mim em /partida/[id]. Mascarar a conta
--     não protegeria ninguém — só faria o app mentir sobre a minha própria
--     história. Por isso a conta sai sempre.
--
--   • O LOCAL de cada partida é rotina de quadra do outro: onde ele joga, com
--     que frequência, em que horário. É o mesmo tipo de dado que
--     `perfis_da_partida()` esconde em `cidade`/`uf`. Sai só sob
--     `pode_ver_perfil()`; caso contrário vira NULL — coluna por coluna, sem
--     sumir com a linha.
--
--   • O AVATAR é foto, e foto tem porteiro próprio: `pode_ver_fotos()`.
--     Mascarado duas vezes — uma pela view, outra aqui; o porquê está
--     escrito no `select` final.
--
--   • O NOME sai aberto, como já sai em `perfis_da_partida()` e na própria
--     view — sem ele nem dá para saber de quem é o retrospecto.
--
-- E, antes de tudo isso: o perfil do adversário é lido de `public.perfis`, a
-- view mascarada, nunca da tabela `public.profiles`. É a regra do AGENTS.md, e
-- numa função SECURITY DEFINER ela é o que impede a próxima coluna acrescentada
-- aqui de sair crua.
--
--   • PARCEIRO DE DUPLA NÃO SAI. Nem o nome, nem o id. A pessoa que jogou do
--     meu lado (ou do lado dele) é um TERCEIRO, que não pediu para aparecer
--     nesta conversa e cuja privacidade esta função não avalia uma a uma. Por
--     isso o placar de cada confronto é devolvido orientado por MIM
--     (`eu` x `ele`) em vez de por time: o formato de saída já torna o
--     vazamento impossível, em vez de depender de alguém lembrar de filtrar.
--
-- `perfil_aberto` vai junto no retorno para a tela poder ser honesta: dizer
-- "este jogador não abre o perfil para você" é diferente de deixar o local em
-- branco sem explicação.


-- ----------------------------------------------------------------------------
-- 2. historico_confrontos()
-- ----------------------------------------------------------------------------
-- Devolve SEMPRE uma linha só (ou nenhuma, se não houver sessão): a conta
-- agregada do par mais `confrontos`, um array jsonb com os últimos jogos.
-- Uma linha em vez de N porque a tela precisa da conta inteira — sobre TODOS
-- os confrontos — junto de uma lista curta; devolver N linhas obrigaria o
-- cliente a somar, e somar no cliente é como um total passa a discordar do
-- outro.
--
-- O `drop` antes do `create or replace` existe porque trocar o tipo de retorno
-- de uma função é a única mudança que o `replace` recusa. Só derruba função,
-- nunca dado.
drop function if exists public.historico_confrontos(uuid, int);

create or replace function public.historico_confrontos(
  p_adversario uuid,
  p_limite     int default 10
)
returns table (
  adversario_id     uuid,
  adversario_nome   text,
  adversario_avatar text,
  -- false = `pode_ver_perfil()` disse não; o `local` dos confrontos vem NULL.
  perfil_aberto     boolean,
  jogos             int,
  vitorias_minhas   int,
  vitorias_dele     int,
  sets_a_favor      int,
  sets_contra       int,
  saldo_sets        int,
  -- [{ match_id, data_hora, local, tipo, eu_venci, sets_meus, sets_dele,
  --    sets: [{ eu, ele }, ...] }, ...], do mais recente para o mais antigo.
  confrontos        jsonb
)
language plpgsql
stable
security definer
-- search_path fixo: sem isso o painel do Supabase acusa "function search path
-- mutable", e com razão — numa função SECURITY DEFINER um search_path vindo de
-- fora escolheria qual `profiles` é `profiles`. `pg_temp` no fim pela mesma
-- razão: esquema temporário de sessão não pode entrar na frente do público.
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_me     uuid := auth.uid();
  v_aberto boolean;
begin
  -- Sem sessão não há "eu", e sem "eu" não existe confronto. Contra si mesmo
  -- também não: devolver a própria linha aqui só produziria uma tela absurda.
  if v_me is null or p_adversario is null or p_adversario = v_me then
    return;
  end if;

  v_aberto := public.pode_ver_perfil(p_adversario);

  return query
  with
  -- Os confrontos crus: partidas com resultado confirmado em que nós dois
  -- jogamos em LADOS OPOSTOS. As duas condições cruzadas são o filtro inteiro
  -- — quem jogou do mesmo lado que eu não cai em nenhuma das duas.
  bruto as (
    select r.match_id,
           coalesce(m.data_hora, r.confirmado_em) as data_hora,
           m.local_texto,
           m.tipo,
           (v_me = any(r.vencedores))             as eu_venci,
           r.sets,
           r.sets_vencedor,
           r.sets_perdedor
      from public.match_results r
      -- left join de propósito: resultado órfão de partida (dado antigo,
      -- partida apagada) ainda é um confronto que aconteceu e tem que entrar
      -- na conta. Perde-se o local, e a data cai no `confirmado_em`.
      left join public.matches m on m.id = r.match_id
     where r.status = 'confirmado'
       and (
             (v_me = any(r.vencedores) and p_adversario = any(r.perdedores))
          or (v_me = any(r.perdedores) and p_adversario = any(r.vencedores))
           )
  ),
  -- Vira o placar para o meu lado. `sets_vencedor`/`sets_perdedor` são do
  -- ponto de vista de quem ganhou; daqui pra frente tudo é "meu" e "dele".
  meu as (
    select b.*,
           case when b.eu_venci then b.sets_vencedor else b.sets_perdedor end as meus,
           case when b.eu_venci then b.sets_perdedor else b.sets_vencedor end as dele
      from bruto b
  ),
  -- A conta é sobre TODOS os confrontos. A lista, só sobre os últimos.
  conta as (
    select count(*)::int                               as n,
           count(*) filter (where c.eu_venci)::int     as v_minhas,
           count(*) filter (where not c.eu_venci)::int as v_dele,
           coalesce(sum(c.meus), 0)::int               as s_favor,
           coalesce(sum(c.dele), 0)::int               as s_contra
      from meu c
  ),
  ultimos as (
    select c.*
      from meu c
     order by c.data_hora desc nulls last
     limit greatest(coalesce(p_limite, 10), 1)
  ),
  lista as (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'match_id',  u.match_id,
                 'data_hora', u.data_hora,
                 -- MASCARADO: ver o bloco 1. NULL é intencional, não é bug.
                 'local',     case when v_aberto then u.local_texto end,
                 'tipo',      u.tipo,
                 'eu_venci',  u.eu_venci,
                 'sets_meus', u.meus,
                 'sets_dele', u.dele,
                 'sets',      (
                   -- Cada set também vira "eu x ele". Sem nome de ninguém
                   -- dentro: o parceiro de dupla não entra no retorno.
                   select coalesce(
                            jsonb_agg(
                              jsonb_build_object(
                                'eu',  case when u.eu_venci then (s.valor->>'v')::int
                                                            else (s.valor->>'p')::int end,
                                'ele', case when u.eu_venci then (s.valor->>'p')::int
                                                            else (s.valor->>'v')::int end
                              )
                              order by s.ordem
                            ),
                            '[]'::jsonb
                          )
                     from jsonb_array_elements(coalesce(u.sets, '[]'::jsonb))
                          with ordinality as s(valor, ordem)
                 )
               )
               order by u.data_hora desc nulls last
             ),
             '[]'::jsonb
           ) as itens
      from ultimos u
  )
  select p_adversario,
         pr.nome,
         -- SEGUNDA FECHADURA NA MESMA PORTA, de propósito.
         --
         -- `public.perfis` já devolve `avatar_url` mascarado por
         -- `pode_ver_fotos(id)`, então este `case` é redundante hoje. Fica
         -- por três razões:
         --
         --   1. ele só consegue SUBTRAIR. O que chega da view já veio
         --      mascarado, então este `case` ou repete o NULL ou repete o
         --      mesmo valor — não existe caminho em que ele ABRA algo que a
         --      view fechou. Redundância que só aperta não vira buraco
         --      quando a regra canônica mudar;
         --   2. é o estilo que o projeto já adotou em
         --      `atividades_do_perfil()`: filtros em série, "cada um capaz de
         --      barrar sozinho";
         --   3. deixa a máscara visível para quem lê ESTA função, sem
         --      precisar abrir a definição da view para saber que a foto tem
         --      porteiro.
         case when public.pode_ver_fotos(p_adversario) then pr.avatar_url end,
         v_aberto,
         conta.n,
         conta.v_minhas,
         conta.v_dele,
         conta.s_favor,
         conta.s_contra,
         (conta.s_favor - conta.s_contra),
         lista.itens
    -- left join no perfil para a função devolver uma linha mesmo se o id não
    -- existir mais: a tela mostra "vocês ainda não se enfrentaram" em vez de
    -- ficar carregando para sempre um dado que nunca vem.
    --
    -- A VIEW `public.perfis`, NUNCA A TABELA `public.profiles`. Esta função é
    -- SECURITY DEFINER: lendo a tabela crua ela passaria por cima da RLS, e
    -- hoje isso não vazaria nada (só `nome` sai daqui, que é aberto na view
    -- de qualquer jeito) — mas quem acrescentasse `pr.cidade` ou
    -- `pr.skill_level` neste select amanhã levaria o dado sem máscara, sem
    -- nenhum aviso. Lendo a view, coluna nova já nasce mascarada.
    from (select p_adversario as id) alvo
    left join public.perfis pr on pr.id = alvo.id
    cross join conta
    cross join lista;
end
$fn$;

comment on function public.historico_confrontos(uuid, int) is
  'Retrospecto do usuário logado contra p_adversario, só com resultados confirmados e só em lados opostos da rede. Uma linha: conta agregada + últimos confrontos em jsonb. Local mascarado por pode_ver_perfil(), avatar por pode_ver_fotos(), e parceiro de dupla nunca sai.';


-- ----------------------------------------------------------------------------
-- 3. GRANTS
-- ----------------------------------------------------------------------------
-- O `revoke` vem antes do `grant`, e tira de PUBLIC — não só de `anon`.
-- O Postgres concede EXECUTE a PUBLIC em toda função nova, e `anon` é membro
-- de PUBLIC como todo mundo: revogar só de `anon` fecha a porta da frente e
-- deixa a dos fundos aberta. Este projeto já teve seis funções nessa situação.
-- `anon` aparece junto por explicitude, não por necessidade.
--
-- `service_role` fica de fora de propósito: a função inteira é escrita em
-- volta de `auth.uid()` e, sem sessão, não devolve nada. Conceder seria
-- prometer um uso que não existe.
revoke execute on function public.historico_confrontos(uuid, int) from public, anon;
grant  execute on function public.historico_confrontos(uuid, int) to authenticated;
