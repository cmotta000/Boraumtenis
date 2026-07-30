import { Link, Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CourtLine, Wordmark } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors, font } from '@/theme/tokens';

/**
 * Página de retorno do login social (Google).
 *
 * No web, ao chegar aqui com `?code=...`, o supabase-js troca o código por uma
 * sessão sozinho (detectSessionInUrl) e o AuthProvider dispara o SIGNED_IN.
 * Só precisamos aguardar a sessão aparecer e então mandar o usuário pra dentro.
 */
export default function AuthCallback() {
  const { session } = useAuth();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Se em ~10s nada acontecer, o login provavelmente falhou.
    const timer = setTimeout(() => setFailed(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  if (session) return <Redirect href="/inicio" />;

  return (
    <View style={styles.fill}>
      <Wordmark tone="light" />
      <CourtLine style={{ width: 90, marginVertical: 20 }} />
      {failed ? (
        <>
          <Text style={styles.msg}>Não deu pra concluir o login.</Text>
          <Link href="/entrar" style={styles.link}>
            Tentar novamente
          </Link>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.chalk} />
          <Text style={styles.msg}>Entrando…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.clay, alignItems: 'center', justifyContent: 'center', padding: 24 },
  msg: { color: colors.line, fontFamily: font.body, fontSize: 16, marginTop: 16 },
  link: { color: colors.ball, fontFamily: font.body, fontWeight: '700', fontSize: 16, marginTop: 10 },
});
