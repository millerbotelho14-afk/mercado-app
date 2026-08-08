import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { closeDb, db, hasDb, openDbFor, type Override, type Purchase } from './db/schema';
import { ensureSeeded } from './db/seed';
import { activePurchases, buildProducts, byMonth, toOverrideMap } from './lib/selectors';
import { displayNameOf, initialsOf, useSession } from './sync/auth';
import { runSync } from './sync/sync';
import { useTheme } from './lib/theme';
import { useToast } from './components/Toast';
import Login from './components/Login';
import VisaoGeral from './components/VisaoGeral';
import Analises from './components/Analises';
import Busca from './components/Busca';
import Historico from './components/Historico';
import NovaCompra from './components/NovaCompra';
import Conta from './components/Conta';
import NovaSenha from './components/NovaSenha';

const TABS = [
  { id: 'geral', icon: '📊', label: 'Visão Geral', short: 'Geral' },
  { id: 'analises', icon: '📈', label: 'Análises', short: 'Análises' },
  { id: 'busca', icon: '🔍', label: 'Buscar', short: 'Buscar' },
  { id: 'historico', icon: '🧾', label: 'Compras', short: 'Compras' },
  { id: 'nova', icon: '➕', label: 'Nova', short: 'Nova' },
] as const;

type TabId = (typeof TABS)[number]['id'] | 'conta';

export default function App() {
  const { session, loading, recovering, finishRecovery } = useSession();
  const [tab, setTab] = useState<TabId>('geral');
  const [dbReady, setDbReady] = useState(false);
  const { toast, node: toastNode } = useToast();
  const { choice, cycle } = useTheme();

  const userId = session?.user.id ?? null;

  /** Cada conta tem o seu banco; trocar de conta troca de banco. */
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      closeDb();
      setDbReady(false);
      return;
    }
    setDbReady(false);
    (async () => {
      await openDbFor(userId);
      await ensureSeeded();
      if (!cancelled) setDbReady(true);
      // Ao entrar, busca o que o outro aparelho registrou.
      runSync().catch(() => {
        /* sem rede ou tabelas ausentes: o app segue local */
      });
    })().catch((e) => console.error('Falha ao abrir a conta', e));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const rawPurchases =
    useLiveQuery<Purchase[]>(
      async () => (dbReady && hasDb() ? db().purchases.toArray() : []),
      [dbReady, userId],
    ) ?? [];
  const overridesList =
    useLiveQuery<Override[]>(
      async () => (dbReady && hasDb() ? db().overrides.toArray() : []),
      [dbReady, userId],
    ) ?? [];

  const purchases = useMemo(
    () => activePurchases(rawPurchases).sort((a, b) => a.date.localeCompare(b.date)),
    [rawPurchases],
  );
  const overrides = useMemo(() => toOverrideMap(overridesList), [overridesList]);
  const products = useMemo(() => buildProducts(purchases, overrides), [purchases, overrides]);
  const months = useMemo(() => byMonth(purchases), [purchases]);

  if (loading) {
    return (
      <div className="center-screen">
        <span className="spinner" />
        Carregando…
      </div>
    );
  }

  if (!session) return <Login />;

  // Chegou pelo link de recuperação: a senha antiga ainda vale, e ela não a
  // lembra. Definir a nova vem antes de qualquer outra coisa.
  if (recovering) {
    return (
      <NovaSenha
        onDone={() => {
          finishRecovery();
          toast('Senha alterada. Já pode usar a nova.');
        }}
      />
    );
  }

  if (!dbReady) {
    return (
      <div className="center-screen">
        <span className="spinner" />
        Abrindo os seus dados…
      </div>
    );
  }

  const themeTitle = choice === 'system' ? 'do sistema' : choice === 'light' ? 'claro' : 'escuro';

  return (
    <div className="app">
      <header className="hd">
        <div>
          <div className="hd-t">🛒 {displayNameOf(session)}</div>
          <div className="hd-s">
            {purchases.length === 0
              ? 'Nenhuma compra ainda'
              : `${purchases.length} compras · ${months.length} ${months.length === 1 ? 'mês' : 'meses'}`}
          </div>
        </div>
        <div className="hd-actions">
          <button className="icon-btn" onClick={cycle} title={`Tema: ${themeTitle}`} aria-label="Alternar tema">
            {choice === 'system' ? '🌗' : choice === 'light' ? '☀️' : '🌙'}
          </button>
          <button
            className="avatar"
            onClick={() => setTab('conta')}
            title="Conta e ajustes"
            aria-label="Conta e ajustes"
          >
            {initialsOf(session)}
          </button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {tab === 'geral' && (
        <VisaoGeral purchases={purchases} months={months} overrides={overrides} toast={toast} />
      )}
      {tab === 'analises' && (
        <Analises purchases={purchases} months={months} products={products} overrides={overrides} />
      )}
      {tab === 'busca' && <Busca products={products} />}
      {tab === 'historico' && (
        <Historico purchases={purchases} overrides={overrides} toast={toast} />
      )}
      {tab === 'nova' && (
        <NovaCompra
          purchases={purchases}
          products={products}
          toast={toast}
          onSaved={() => setTab('historico')}
        />
      )}
      {tab === 'conta' && (
        <Conta session={session} purchaseCount={purchases.length} toast={toast} />
      )}

      <nav className="bottomnav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`bn${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="ic">{t.icon}</span>
            {t.short}
          </button>
        ))}
      </nav>

      {toastNode}
    </div>
  );
}
