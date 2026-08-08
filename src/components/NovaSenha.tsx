import { useState } from 'react';
import { changePassword, signOut } from '../sync/auth';
import CampoSenha from './CampoSenha';

interface Props {
  onDone: () => void;
}

/**
 * Tela que aparece quando a pessoa chega pelo link do e-mail de recuperação.
 * O link já a autenticou, mas a senha continua a antiga — que ela não lembra.
 * Sem esta tela, ela entraria no app e ficaria travada de novo no próximo login.
 */
export default function NovaSenha({ onDone }: Props) {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const curta = senha.length > 0 && senha.length < 6;
  const diferentes = confirmacao.length > 0 && senha !== confirmacao;
  const podeSalvar = senha.length >= 6 && senha === confirmacao && !salvando;

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    setErro(null);
    try {
      await changePassword(senha);
      onDone();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-card" style={{ maxWidth: 420, margin: '0 auto' }}>
          <div className="auth-brand">
            <span className="auth-mark">🔑</span>
            Definir nova senha
          </div>
          <p className="hint">
            Escolha uma senha nova. Depois disso você entra normalmente com ela.
          </p>

          <CampoSenha
            id="ns-senha"
            label="Nova senha"
            value={senha}
            onChange={setSenha}
            autoComplete="new-password"
            placeholder="pelo menos 6 caracteres"
          />
          <CampoSenha
            id="ns-confirma"
            label="Repita a nova senha"
            value={confirmacao}
            onChange={setConfirmacao}
            autoComplete="new-password"
            onEnter={salvar}
          />

          {curta && <div className="alert-price mid">A senha precisa de pelo menos 6 caracteres.</div>}
          {diferentes && <div className="alert-price hi">As duas senhas não são iguais.</div>}
          {erro && <div className="alert-price hi">{erro}</div>}

          <button className="btn pri block" onClick={salvar} disabled={!podeSalvar}>
            {salvando ? (
              <>
                <span className="spinner" /> Salvando…
              </>
            ) : (
              'Salvar nova senha'
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: 14 }}>
            <button className="link-btn" onClick={() => signOut()}>
              Cancelar e sair
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
