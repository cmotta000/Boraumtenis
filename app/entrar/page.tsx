'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Btn, CourtLine, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';

import estilos from './entrar.module.css';

type Mode = 'entrar' | 'criar';

export default function Entrar() {
  const { session } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Quem já está logado não tem o que fazer aqui.
  useEffect(() => {
    if (session) router.replace('/inicio');
  }, [session, router]);

  async function entrarComGoogle() {
    setErro(null);
    setAviso(null);
    setGoogleBusy(true);
    try {
      // A aba é redirecionada para o Google; a volta cai em /auth/callback.
      await signInWithGoogle();
    } catch (e) {
      setErro(traduzErro(e instanceof Error ? e.message : 'Não foi possível entrar com o Google.'));
      setGoogleBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (!email.trim() || senha.length < 6) {
      setErro('Informe um e-mail válido e uma senha de pelo menos 6 caracteres.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'criar') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() || undefined } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/inicio');
        } else {
          setAviso('Conta criada! Confirme pelo link no seu e-mail e depois entre.');
          setMode('entrar');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) throw error;
        router.replace('/inicio');
      }
    } catch (e) {
      setErro(traduzErro(e instanceof Error ? e.message : 'Algo deu errado.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={estilos.fill}>
      <div className={estilos.shell}>
        {/* Painel de marca (some nas telas estreitas) */}
        <div className={estilos.brand}>
          <Wordmark tone="light" />
          <h1 className={estilos.brandH}>Bora jogar?</h1>
          <CourtLine className={estilos.brandRisco} />
          <p className={estilos.brandP}>
            Entre para achar partidas num raio de 70 km, marcar jogos e acompanhar seu ranking.
          </p>
        </div>

        {/* Formulário */}
        <div className={estilos.card}>
          <div className={estilos.marcaMobile}>
            <Wordmark tone="dark" />
          </div>

          <div className={estilos.tabs} role="tablist">
            {(['entrar', 'criar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={estilos.tab}>
                {m === 'entrar' ? 'Entrar' : 'Criar conta'}
                {mode === m && <span className={estilos.tabBar} />}
              </button>
            ))}
          </div>

          <form onSubmit={submit}>
            {mode === 'criar' && (
              <Campo
                label="Nome"
                value={nome}
                onChange={setNome}
                placeholder="Como te chamam na quadra"
                autoComplete="name"
              />
            )}
            <Campo
              label="E-mail"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              type="email"
              autoComplete="email"
            />
            <Campo
              label="Senha"
              value={senha}
              onChange={setSenha}
              placeholder="mínimo 6 caracteres"
              type="password"
              autoComplete={mode === 'criar' ? 'new-password' : 'current-password'}
            />

            {erro && <p className={estilos.erro}>{erro}</p>}
            {aviso && <p className={estilos.aviso}>{aviso}</p>}

            <Btn
              type="submit"
              label={mode === 'entrar' ? 'Entrar' : 'Criar conta'}
              loading={busy}
              full
              className={estilos.enviar}
            />
          </form>

          <div className={estilos.divider}>
            <span className={estilos.dividerLine} />
            <span className={estilos.dividerText}>ou</span>
            <span className={estilos.dividerLine} />
          </div>

          <button type="button" onClick={entrarComGoogle} disabled={googleBusy} className={estilos.google}>
            <span className={estilos.googleG} aria-hidden>
              G
            </span>
            {googleBusy ? 'Abrindo o Google…' : 'Continuar com o Google'}
          </button>

          <Link href="/" className={estilos.back}>
            ← Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.ComponentProps<'input'>, 'value' | 'onChange'>) {
  const id = `campo-${label.toLowerCase().replace(/[^a-z]/g, '')}`;
  return (
    <div className={estilos.campo}>
      <label htmlFor={id} className={estilos.label}>
        {label}
      </label>
      <input
        {...props}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={estilos.input}
      />
    </div>
  );
}

function traduzErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta. Tente entrar.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Espere um instante e tente de novo.';
  return msg;
}
