import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  changePassword,
  deleteOwnAccount,
  profileOf,
  saveProfile,
  signOut,
  type Profile,
} from '../sync/auth';
import { deleteDbFor } from '../db/schema';
import CampoSenha from './CampoSenha';
import { downloadJSON, exportJSON, importJSON } from '../db/repo';
import { getSyncState, resetSyncCursor, runSync, type SyncResult } from '../sync/sync';
import { todayISO } from '../lib/format';
import { useTheme, type ThemeChoice } from '../lib/theme';

interface Props {
  session: Session;
  purchaseCount: number;
  toast: (m: string) => void;
}

const THEMES: Array<{ id: ThemeChoice; label: string; icon: string }> = [
  { id: 'system', label: 'Do sistema', icon: '🌗' },
  { id: 'light', label: 'Claro', icon: '☀️' },
  { id: 'dark', label: 'Escuro', icon: '🌙' },
];

export default function Conta({ session, purchaseCount, toast }: Props) {
  const [profile, setProfile] = useState<Profile>(() => profileOf(session));
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState('');
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const { choice, setChoice } = useTheme();

  useEffect(() => {
    getSyncState().then((s) => setLastSyncAt(s.lastSyncAt));
  }, [lastResult]);

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError(null);
    try {
      await saveProfile(profile);
      toast('Dados salvos.');
    } catch (e) {
      setProfileError((e as Error).message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePassword() {
    setPasswordBusy(true);
    try {
      await changePassword(newPassword);
      setNewPassword('');
      toast('Senha alterada.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleSync(full = false) {
    setSyncBusy(true);
    setSyncError(null);
    try {
      if (full) await resetSyncCursor();
      const result = await runSync();
      setLastResult(result);
      const moved =
        result.pushedPurchases +
        result.pulledPurchases +
        result.pushedOverrides +
        result.pulledOverrides;
      toast(
        moved === 0
          ? 'Tudo já estava em dia'
          : `↑ ${result.pushedPurchases} enviadas · ↓ ${result.pulledPurchases} recebidas`,
      );
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setExcluindo(true);
    setErroExclusao(null);
    try {
      const userId = session.user.id;
      await deleteOwnAccount();
      // Só depois de a nuvem confirmar. Apagar aqui antes deixaria o aparelho
      // vazio com a conta ainda existindo.
      await deleteDbFor(userId);
    } catch (e) {
      setErroExclusao((e as Error).message);
      setExcluindo(false);
    }
  }

  async function handleExport() {
    downloadJSON(await exportJSON(), `compras-${todayISO()}.json`);
    toast('Backup exportado');
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await importJSON(await file.text());
      toast(
        `${result.added} compra(s) importada(s)` +
          (result.skipped ? ` · ${result.skipped} já existiam` : ''),
      );
    } catch (err) {
      toast(`Falha ao importar: ${(err as Error).message}`);
    } finally {
      e.target.value = '';
    }
  }

  return (
    <>
      <div className="card">
        <div className="ct">Dados cadastrais</div>
        <div className="frow c2">
          <div className="field">
            <label className="lb" htmlFor="ct-house">
              Nome da casa
            </label>
            <input
              id="ct-house"
              className="in"
              value={profile.household}
              onChange={(e) => setProfile({ ...profile, household: e.target.value })}
              placeholder="Ex.: Família Silva"
            />
          </div>
          <div className="field">
            <label className="lb" htmlFor="ct-name">
              Seu nome
            </label>
            <input
              id="ct-name"
              className="in"
              value={profile.displayName}
              onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
              placeholder="Como você quer ser chamado"
            />
          </div>
        </div>
        <div className="frow c2">
          <div className="field">
            <label className="lb" htmlFor="ct-city">
              Cidade
            </label>
            <input
              id="ct-city"
              className="in"
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              placeholder="Ex.: Taboão da Serra"
            />
          </div>
          <div className="field">
            <label className="lb" htmlFor="ct-email">
              E-mail
            </label>
            <input id="ct-email" className="in" value={session.user.email ?? ''} disabled />
          </div>
        </div>
        {profileError && <div className="alert-price hi">{profileError}</div>}
        <div className="row-actions">
          <button className="btn pri" onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? 'Salvando…' : 'Salvar dados'}
          </button>
        </div>
        <p className="note">
          O nome da casa é o que aparece no topo do app. Fica guardado na sua conta, então
          acompanha você em qualquer aparelho.
        </p>
      </div>

      <div className="card">
        <div className="ct">Aparência</div>
        <div className="row-actions">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`btn${choice === t.id ? ' pri' : ''}`}
              onClick={() => setChoice(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <p className="note">
          "Do sistema" acompanha o modo escuro do celular ou do computador, inclusive quando ele
          muda sozinho de noite.
        </p>
      </div>

      <div className="card">
        <div className="ct">
          Sincronia
          <span className="sub">{purchaseCount} compras neste aparelho</span>
        </div>
        <p style={{ fontSize: 12.5, color: 'var(--mu)', marginTop: 0 }}>
          {lastSyncAt
            ? `Última sincronia às ${new Date(lastSyncAt).toLocaleString('pt-BR')}.`
            : 'Ainda não sincronizado neste aparelho.'}
          {lastResult && (
            <>
              {' '}
              Enviadas {lastResult.pushedPurchases} compras e {lastResult.pushedOverrides}{' '}
              correções; recebidas {lastResult.pulledPurchases} e {lastResult.pulledOverrides}.
            </>
          )}
        </p>
        {syncError && <div className="alert-price hi">{syncError}</div>}
        <div className="row-actions">
          <button className="btn pri" onClick={() => handleSync()} disabled={syncBusy}>
            {syncBusy ? (
              <>
                <span className="spinner" /> Sincronizando…
              </>
            ) : (
              '⟳ Sincronizar agora'
            )}
          </button>
          <button className="btn" onClick={() => handleSync(true)} disabled={syncBusy}>
            Rebaixar tudo
          </button>
        </div>
        <p className="note">
          Sincroniza sozinho ao abrir. "Rebaixar tudo" serve num aparelho novo, para trazer o
          histórico inteiro de uma vez.
        </p>
      </div>

      <div className="card">
        <div className="ct">Backup</div>
        <div className="row-actions">
          <button className="btn" onClick={handleExport}>
            ⬇ Exportar JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⬆ Importar JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden-file"
            onChange={handleImport}
          />
        </div>
        <p className="note">
          A importação ignora compras que já existem (mesma loja, data e valor), então dá para
          reimportar o mesmo arquivo sem duplicar nada.
        </p>
      </div>

      <div className="card">
        <div className="ct">Segurança</div>
        <CampoSenha
          id="ct-pass"
          label="Nova senha"
          value={newPassword}
          onChange={setNewPassword}
          autoComplete="new-password"
          placeholder="pelo menos 6 caracteres"
        />
        <div className="row-actions">
          <button
            className="btn"
            onClick={handlePassword}
            disabled={passwordBusy || newPassword.length < 6}
          >
            Alterar senha
          </button>
          <button className="btn danger" onClick={() => signOut()}>
            Sair da conta
          </button>
        </div>
      </div>

      <div className="card danger-zone">
        <div className="ct">Excluir a conta</div>
        <p style={{ fontSize: 12.5, color: 'var(--mu)', marginTop: 0 }}>
          Apaga a conta e <strong>todas as {purchaseCount} compras</strong>, na nuvem e neste
          aparelho. É definitivo — não há como desfazer, e nem eu consigo recuperar depois.
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--mu)' }}>
          Se quiser guardar o histórico antes, use <strong>Exportar JSON</strong> acima.
        </p>
        <div className="field">
          <label className="lb" htmlFor="ct-del">
            Para confirmar, escreva <strong>EXCLUIR</strong> abaixo
          </label>
          <input
            id="ct-del"
            className="in"
            value={confirmacaoExclusao}
            onChange={(e) => setConfirmacaoExclusao(e.target.value)}
            placeholder="EXCLUIR"
            autoComplete="off"
          />
        </div>
        {erroExclusao && <div className="alert-price hi">{erroExclusao}</div>}
        <button
          className="btn danger"
          onClick={handleDeleteAccount}
          disabled={confirmacaoExclusao.trim().toUpperCase() !== 'EXCLUIR' || excluindo}
        >
          {excluindo ? (
            <>
              <span className="spinner" /> Excluindo…
            </>
          ) : (
            'Excluir minha conta e apagar tudo'
          )}
        </button>
      </div>
    </>
  );
}
