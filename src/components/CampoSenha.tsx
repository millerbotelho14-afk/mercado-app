import { useState } from 'react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** `new-password` no cadastro e na troca; `current-password` no login. */
  autoComplete: 'new-password' | 'current-password';
  placeholder?: string;
  onEnter?: () => void;
}

/**
 * Campo de senha com botão de mostrar. Digitar senha no celular erra muito, e
 * conseguir conferir antes de enviar evita o "senha incorreta" que não é senha
 * errada, é dedo errado.
 */
export default function CampoSenha({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  onEnter,
}: Props) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="field">
      <label className="lb" htmlFor={id}>
        {label}
      </label>
      <div className="senha-wrap">
        <input
          id={id}
          className="in"
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        />
        <button
          type="button"
          className="senha-olho"
          onClick={() => setVisivel((v) => !v)}
          // O rótulo diz o que ACONTECE ao clicar, que é o que o leitor de tela precisa.
          aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
          title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visivel ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );
}
