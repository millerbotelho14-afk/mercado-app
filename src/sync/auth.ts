import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, syncConfigured } from './client';

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(syncConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, loading };
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
