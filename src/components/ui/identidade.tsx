'use client';

import { useAvatarUrl } from '@/lib/fotos';

import estilos from './identidade.module.css';

/** Marca. O ponto é a bola. */
export function Wordmark({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  return (
    <div className={estilos.wordmark}>
      <span className={estilos.ballDot} aria-hidden />
      <span className={`${estilos.wordmarkText} ${tone === 'light' ? estilos.claro : estilos.escuro}`}>
        BORA UM TÊNIS
      </span>
    </div>
  );
}

/** Avatar circular: foto de perfil quando existe, iniciais quando não. */
export function Avatar({
  nome,
  foto,
  size = 40,
  aro,
}: {
  nome?: string | null;
  /** Caminho no bucket `avatares` ou URL pronta. */
  foto?: string | null;
  size?: number;
  /** Aro claro em volta — usado sobre fundos coloridos. */
  aro?: boolean;
}) {
  const url = useAvatarUrl(foto);
  const classe = `${estilos.avatar} ${aro ? estilos.aro : ''}`;
  const medida = { width: size, height: size };

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- URL dinâmica do Storage; o otimizador não ajuda.
    return (
      <img
        src={url}
        alt={nome ? `Foto de ${nome}` : 'Foto de perfil'}
        width={size}
        height={size}
        loading="lazy"
        className={classe}
        style={medida}
      />
    );
  }

  const iniciais = (nome ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className={classe} style={medida} aria-label={nome ? `Foto de ${nome}` : undefined} role="img">
      <span className={estilos.avatarText} style={{ fontSize: size * 0.38 }}>
        {iniciais || '?'}
      </span>
    </div>
  );
}

/** Etiqueta de status. */
export function Pill({
  label,
  tone = 'clay',
}: {
  label: string;
  tone?: 'clay' | 'ok' | 'muted' | 'ball';
}) {
  const classe = { clay: estilos.pillClay, ok: estilos.pillOk, ball: estilos.pillBall, muted: estilos.pillMuted }[
    tone
  ];
  return <span className={`${estilos.pill} ${classe}`}>{label}</span>;
}
