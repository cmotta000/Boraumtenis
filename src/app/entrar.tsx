import { Link, Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Btn, CourtLine, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { colors, elev, font, maxW, radius } from '@/theme/tokens';

type Mode = 'entrar' | 'criar';

export default function Entrar() {
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 820;

  const [mode, setMode] = useState<Mode>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  if (session) return <Redirect href="/inicio" />;

  async function entrarComGoogle() {
    setErro(null);
    setAviso(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
      // No nativo, ao voltar do navegador a sessão já está pronta; o Redirect
      // acima cuida da navegação. No web, a aba foi redirecionada pro Google.
    } catch (e: any) {
      setErro(traduzErro(e?.message ?? 'Não foi possível entrar com o Google.'));
      setGoogleBusy(false);
    }
  }

  async function submit() {
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
    } catch (e: any) {
      setErro(traduzErro(e?.message ?? 'Algo deu errado.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.shell, wide && styles.shellWide, { maxWidth: wide ? maxW : 460 }]}>
          {/* Painel de marca (só no wide) */}
          {wide && (
            <View style={styles.brand}>
              <Wordmark tone="light" />
              <Text style={styles.brandH}>Bora jogar?</Text>
              <CourtLine style={{ width: 90, marginVertical: 16 }} />
              <Text style={styles.brandP}>
                Entre para achar partidas num raio de 70 km, marcar jogos e acompanhar seu ranking.
              </Text>
            </View>
          )}

          {/* Formulário */}
          <View style={styles.card}>
            {!wide && (
              <View style={{ marginBottom: 22 }}>
                <Wordmark tone="dark" />
              </View>
            )}
            <View style={styles.tabs}>
              <Pressable onPress={() => setMode('entrar')} style={styles.tab}>
                <Text style={[styles.tabText, mode === 'entrar' && styles.tabActive]}>Entrar</Text>
                {mode === 'entrar' && <View style={styles.tabBar} />}
              </Pressable>
              <Pressable onPress={() => setMode('criar')} style={styles.tab}>
                <Text style={[styles.tabText, mode === 'criar' && styles.tabActive]}>
                  Criar conta
                </Text>
                {mode === 'criar' && <View style={styles.tabBar} />}
              </Pressable>
            </View>

            {mode === 'criar' && (
              <Field label="Nome" value={nome} onChangeText={setNome} placeholder="Como te chamam na quadra" />
            )}
            <Field
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              label="Senha"
              value={senha}
              onChangeText={setSenha}
              placeholder="mínimo 6 caracteres"
              secureTextEntry
            />

            {erro && <Text style={styles.erro}>{erro}</Text>}
            {aviso && <Text style={styles.aviso}>{aviso}</Text>}

            <Btn
              label={mode === 'entrar' ? 'Entrar' : 'Criar conta'}
              onPress={submit}
              loading={busy}
              full
              style={{ marginTop: 18 }}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={entrarComGoogle}
              disabled={googleBusy}
              style={({ pressed, hovered }: any) => [
                styles.google,
                (pressed || hovered) && { opacity: 0.9 },
                googleBusy && { opacity: 0.6 },
              ]}>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleText}>
                {googleBusy ? 'Abrindo o Google…' : 'Continuar com o Google'}
              </Text>
            </Pressable>

            <Link href="/" style={styles.back}>
              ← Voltar para a página inicial
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.inkSoft}
        style={styles.input}
      />
    </View>
  );
}

function traduzErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta. Tente entrar.';
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Espere um instante e tente de novo.';
  return msg;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.clay },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 22 },
  shell: { width: '100%', gap: 28 },
  shellWide: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  brand: { flex: 1 },
  brandH: { color: colors.chalk, fontFamily: font.display, fontWeight: '800', fontSize: 44, marginTop: 22 },
  brandP: { color: colors.line, fontFamily: font.body, fontSize: 16, lineHeight: 24, maxWidth: 360 },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 26,
    ...elev.raised,
  },
  tabs: { flexDirection: 'row', gap: 24, marginBottom: 20 },
  tab: { paddingBottom: 8 },
  tabText: { fontFamily: font.display, fontWeight: '700', fontSize: 20, color: colors.inkSoft },
  tabActive: { color: colors.ink },
  tabBar: { height: 3, backgroundColor: colors.ball, borderRadius: 2, marginTop: 6 },
  label: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: colors.inkSoft, marginBottom: 6, textTransform: 'uppercase' },
  input: {
    height: 50,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.net,
    paddingHorizontal: 14,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  erro: { color: colors.danger, fontFamily: font.body, fontSize: 14, marginTop: 4 },
  aviso: { color: colors.ok, fontFamily: font.body, fontSize: 14, marginTop: 4 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.net },
  dividerText: { fontFamily: font.mono, fontSize: 12, color: colors.inkSoft },
  google: {
    height: 50,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.net,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleG: { fontFamily: font.display, fontWeight: '800', fontSize: 18, color: '#4285F4' },
  googleText: { fontFamily: font.body, fontWeight: '600', fontSize: 15, color: colors.ink },
  back: { color: colors.inkSoft, fontFamily: font.body, fontSize: 14, textAlign: 'center', marginTop: 18 },
});
