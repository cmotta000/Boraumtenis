import Link from 'next/link';

import { CourtLine, Wordmark } from '@/components/ui';

import estilos from './landing.module.css';
import { RedirecionaSeLogado } from './redireciona-se-logado';

const SCORE = [
  { k: '70', u: 'km de raio' },
  { k: 'ELO', u: 'ranking real' },
  { k: 'R$0', u: 'pra jogar' },
];

const FEATURES = [
  { t: 'Partidas por perto', d: 'Veja jogos abertos num raio de 70 km e entre com um toque.' },
  { t: 'Ranking que vale', d: 'Cada resultado mexe no seu ELO. Suba de nível jogando.' },
  { t: 'Temporadas', d: 'Dispute o pódio da sua região e colecione conquistas.' },
];

const STEPS = [
  {
    n: '1',
    t: 'Crie ou encontre',
    d: 'Abra uma partida no seu horário ou entre numa que já está de pé perto de você.',
  },
  {
    n: '2',
    t: 'Combine',
    d: 'Peça pra entrar, o criador confirma e vocês acertam os detalhes no chat da partida.',
  },
  {
    n: '3',
    t: 'Jogue e suba',
    d: 'Registrem o placar e o ELO faz o resto: você sobe no ranking da sua região.',
  },
];

export default function Landing() {
  return (
    <div className={estilos.fill}>
      <RedirecionaSeLogado />

      <div className={estilos.container}>
        {/* Topo */}
        <header className={estilos.topbar}>
          <Wordmark tone="light" />
          <Link href="/entrar" className={estilos.topLink}>
            Entrar
          </Link>
        </header>

        {/* Hero */}
        <section className={estilos.hero}>
          <div className={estilos.heroText}>
            <p className={estilos.eyebrow}>TÊNIS AMADOR · ENCONTRE SEU JOGO</p>
            <h1 className={estilos.h1}>
              Ache com quem
              <br />
              jogar pertinho.
            </h1>
            <CourtLine className={estilos.risco} />
            <p className={estilos.lede}>
              O ponto de encontro dos tenistas amadores. Marque partidas com gente do seu nível a até 70 km
              de você, registre o placar e suba no ranking.
            </p>
            <div className={estilos.ctaRow}>
              <Link href="/entrar" className={estilos.botaoBall}>
                Criar conta grátis
              </Link>
              <Link href="/entrar" className={estilos.botaoGhost}>
                Já tenho conta
              </Link>
            </div>

            {/* Placar / scoreboard */}
            <div className={estilos.score}>
              {SCORE.map((s, i) => (
                <div key={s.u} className={estilos.scoreItem}>
                  {i > 0 && <span className={estilos.scoreDiv} />}
                  <span className={estilos.scoreK}>{s.k}</span>
                  <span className={estilos.scoreU}>{s.u}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card de partida aberta — o objeto característico */}
          <div className={estilos.matchCard}>
            <div className={estilos.matchTop}>
              <span className={estilos.livePill}>
                <span className={estilos.liveDot} aria-hidden />
                PARTIDA ABERTA
              </span>
              <span className={estilos.matchDist}>3,2 km</span>
            </div>
            <p className={estilos.matchPlace}>Quadra de Saibro · Vila Madalena</p>
            <p className={estilos.matchWhen}>hoje, 19:00 · simples</p>
            <CourtLine className={estilos.matchLinha} />
            <div className={estilos.matchRow}>
              <div>
                <p className={estilos.playerName}>Rafael</p>
                <p className={estilos.playerElo}>ELO 1240</p>
              </div>
              <span className={estilos.vs}>VS</span>
              <div className={estilos.direita}>
                <p className={estilos.playerName}>vaga aberta</p>
                <p className={`${estilos.playerElo} ${estilos.playerVaga}`}>seu nível?</p>
              </div>
            </div>
            <div className={estilos.matchCta}>Entrar na partida</div>
          </div>
        </section>

        {/* Como funciona */}
        <div className={estilos.howHead}>
          <p className={estilos.sectionEyebrow}>COMO FUNCIONA</p>
          <h2 className={estilos.sectionTitle}>Do sofá pra quadra em 3 passos</h2>
        </div>
        <section className={estilos.steps}>
          {STEPS.map((s, i) => (
            <article key={s.n} className={estilos.step}>
              <div className={estilos.stepNumWrap}>
                <span className={estilos.stepNum}>{s.n}</span>
                {i < STEPS.length - 1 && <span className={estilos.stepBar} />}
              </div>
              <h3 className={estilos.stepT}>{s.t}</h3>
              <p className={estilos.stepD}>{s.d}</p>
            </article>
          ))}
        </section>

        {/* Features */}
        <section className={estilos.features}>
          {FEATURES.map((f) => (
            <article key={f.t} className={estilos.feature}>
              <h3 className={estilos.featureT}>{f.t}</h3>
              <p className={estilos.featureD}>{f.d}</p>
            </article>
          ))}
        </section>

        {/* Faixa de CTA final */}
        <section className={estilos.ctaBand}>
          <div style={{ flex: 1 }}>
            <h2 className={estilos.ctaBandTitle}>Sua próxima partida começa agora.</h2>
            <p className={estilos.ctaBandText}>
              Crie sua conta grátis e veja quem está jogando perto de você.
            </p>
          </div>
          <Link href="/entrar" className={estilos.botaoBall}>
            Começar a jogar
          </Link>
        </section>

        <p className={estilos.foot}>Feito para quem quer jogar mais.</p>
      </div>
    </div>
  );
}
