import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, syncConfigured } from './client';

export function useSession(): {
  session: Session | null;
  loading: boolean;
  /** Entrou pelo link do e-mail de recuperação e precisa definir a nova senha. */
  recovering: boolean;
  finishRecovery: () => void;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(syncConfigured);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // O link do e-mail já autentica a pessoa. Sem marcar este estado, ela cairia
      // direto no app e a senha continuaria a antiga — que ela não lembra.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading, recovering, finishRecovery: () => setRecovering(false) };
}

/** Dispara o e-mail com o link que traz a pessoa de volta para trocar a senha. */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('Sincronia não configurada.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(translate(error.message));
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Sincronia não configurada.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translate(error.message));
}

export async function signUp(
  email: string,
  password: string,
  profile?: Partial<Profile>,
): Promise<'ready' | 'confirm'> {
  if (!supabase) throw new Error('Sincronia não configurada.');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: profile ? { data: profile } : undefined,
  });
  if (error) throw new Error(translate(error.message));
  // Sem sessão na resposta = o projeto exige confirmar o e-mail antes de entrar.
  return data.session ? 'ready' : 'confirm';
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/**
 * Os dados cadastrais ficam no `user_metadata` da própria conta, não numa
 * tabela à parte: nascem junto com o usuário, viajam com a sessão e não pedem
 * migração de banco.
 */
export interface Profile {
  displayName: string;
  household: string;
  city: string;
}

export function profileOf(session: Session | null): Profile {
  const meta = (session?.user.user_metadata ?? {}) as Partial<Profile>;
  return {
    displayName: meta.displayName ?? '',
    household: meta.household ?? '',
    city: meta.city ?? '',
  };
}

/** Nome para mostrar no cabeçalho, com uma escada de quedas até o e-mail. */
export function displayNameOf(session: Session | null): string {
  const profile = profileOf(session);
  return profile.household || profile.displayName || session?.user.email?.split('@')[0] || 'Minha conta';
}

export function initialsOf(session: Session | null): string {
  const name = displayNameOf(session).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function saveProfile(profile: Profile): Promise<void> {
  if (!supabase) throw new Error('Sincronia não configurada.');
  const { error } = await supabase.auth.updateUser({ data: { ...profile } });
  if (error) throw new Error(translate(error.message));
}

export async function changePassword(password: string): Promise<void> {
  if (!supabase) throw new Error('Sincronia não configurada.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(translate(error.message));
}

/**
 * Apaga a conta e tudo que pertence a ela.
 *
 * O navegador não tem permissão para remover um usuário — isso exige a chave
 * secreta, que nunca sai do servidor. Então quem apaga é uma função no banco
 * (`delete_own_account`), que só consegue apagar *quem a chamou*. As compras e
 * as correções vão junto, pelo `on delete cascade` das tabelas.
 */
export async function deleteOwnAccount(): Promise<void> {
  if (!supabase) throw new Error('Sincronia não configurada.');
  const { error } = await supabase.rpc('delete_own_account');
  if (error) {
    if (error.message.includes('function') || error.code === 'PGRST202') {
      throw new Error(
        'A função de exclusão não existe neste banco. Rode supabase/schema.sql novamente.',
      );
    }
    throw new Error(error.message);
  }
  await supabase.auth.signOut();
}

/** As mensagens do Supabase vêm em inglês; as comuns valem traduzir. */
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme o e-mail antes de entrar.';
  if (m.includes('user already registered')) return 'Esse e-mail já tem conta. Use "Entrar".';
  if (m.includes('password should be at least')) return 'A senha precisa de pelo menos 6 caracteres.';
  if (m.includes('unable to validate email')) return 'E-mail inválido.';
  if (m.includes('signups not allowed')) return 'Cadastro desativado no projeto do Supabase.';
  return message;
}
