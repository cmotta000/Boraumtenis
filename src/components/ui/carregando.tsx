import estilos from './carregando.module.css';

/** Roda de carregamento. Herda a cor do texto de quem a contém. */
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Carregando"
      className={[estilos.spinner, className ?? ''].filter(Boolean).join(' ')}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 10)) }}
    />
  );
}

/** Tela inteira enquanto os dados não chegam. */
export function TelaCarregando({ cor }: { cor?: string }) {
  return (
    <div className={estilos.tela} style={{ color: cor }}>
      <Spinner size={24} />
    </div>
  );
}
