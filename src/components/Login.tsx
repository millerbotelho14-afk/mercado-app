import { useState } from 'react';
import { requestPasswordReset, signIn, signUp } from '../sync/auth';
import CampoSenha from './CampoSenha';
import { syncConfigured } from '../sync/client';
import { useTheme } from '../lib/theme';

const POINTS = [
  {
    icon: '🧾',
    title: 'A nota inteira de uma vez',
    text: 'Cole o link do QR Code do cupom e a compra entra completa, item por item, já categorizada.',
  },
  {
    icon: '📉',
    title: 'Preço que sobe você percebe',
    text: 'O histórico de cada produto mostra quanto custava, onde estava mais barato e se hoje está caro.',
  },
  {
    icon: '📲',
    title: 'Funciona no corredor do mercado',
    text: 'Instala no celular, abre sem internet e sincroniza com o computador quando você voltar.',
  },
];

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [household, setHousehold] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { choice, cycle } = useTheme();

  const isSignUp = mode === 'up';
  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  async function handleReset() {
    setError(null);
    setMessage(null);
    if (!email.trim()) {
      setError('Escreva o seu e-mail acima e clique de novo.');
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setMessage(
        'Enviamos um link para o seu e-mail. Abra por ele para escolher uma senha nova.',
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (isSignUp) {
        const outcome = await signUp(email.trim(), password, {
          household: household.trim(),
        });
        if (outcome === 'confirm') {
          setMessage('Conta criada. Confirme pelo link que enviamos no seu e-mail e volte para entrar.');
          setMode('in');
        }
      } else {
        await signIn(email.trim(), password);
      }
      setPassword('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-grid">
          <div>
            <div className="auth-brand">
              <span className="auth-mark">🛒</span>
              Controle de Supermercado
            </div>
            <h1 className="auth-title">Saiba para onde vai o dinheiro do mercado.</h1>
            <p className="auth-lead">
              Cada compra vira histórico de preço por produto e por loja. Com o tempo, o app
              responde o que a memória não responde: isto está caro? onde custava menos?
            </p>
            <ul className="auth-points">
              {POINTS.map((p) => (
                <li className="auth-point" key={p.title}>
                  <span className="pi">{p.icon}</span>
                  <span>
                    <b>{p.title}</b>
                    <span>{p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-card">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button
                className="icon-btn"
                onClick={cycle}
                title={`Tema: ${choice === 'system' ? 'do sistema' : choice === 'light' ? 'claro' : 'escuro'}`}
                aria-label="Alternar tema"
              >
                {choice === 'system' ? '🌗' : choice === 'light' ? '☀️' : '🌙'}
              </button>
            </div>

            <h2>{isSignUp ? 'Criar conta' : 'Entrar'}</h2>
            <p className="hint">
              {isSignUp
                ? 'Suas compras ficam na sua conta, só suas.'
                : 'Use a mesma conta no celular e no computador.'}
            </p>

            <div className="auth-switch">
              <button className={!isSignUp ? 'active' : ''} onClick={() => setMode('in')}>
                Entrar
              </button>
              <button className={isSignUp ? 'active' : ''} onClick={() => setMode('up')}>
                Criar conta
              </button>
            </div>

            {!syncConfigured ? (
              <div className="alert-price hi">
                O app está sem as chaves do servidor, então não dá para entrar. Configure
                VITE_SUPABASE_URL e VITE_SUPABASE_KEY.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {isSignUp && (
                  <div className="field">
                    <label className="lb" htmlFor="lg-house">
                      Como chamar a sua casa
                    </label>
                    <input
                      id="lg-house"
                      className="in"
                      value={household}
                      onChange={(e) => setHousehold(e.target.value)}
                      placeholder="Ex.: Família Silva"
                      autoComplete="off"
                    />
                  </div>
                )}
                <div className="field">
                  <label className="lb" htmlFor="lg-email">
                    E-mail
                  </label>
                  <input
                    id="lg-email"
                    className="in"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
                <CampoSenha
                  id="lg-pass"
                  label="Senha"
                  value={password}
                  onChange={setPassword}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder={isSignUp ? 'pelo menos 6 caracteres' : ''}
                  onEnter={handleSubmit}
                />

                {!isSignUp && (
                  <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 12 }}>
                    <button type="button" className="link-btn" onClick={handleReset}>
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                {error && <div className="alert-price hi">{error}</div>}
                {message && <div className="alert-price lo">{message}</div>}

                <button
                  className="btn pri block"
                  type="submit"
                  disabled={!canSubmit}
                  style={{ marginTop: 6 }}
                >
                  {busy ? (
                    <>
                      <span className="spinner" /> Aguarde…
                    </>
                  ) : isSignUp ? (
                    'Criar minha conta'
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      <div className="auth-foot">Seus dados ficam na sua conta e no seu aparelho.</div>
    </div>
  );
}
