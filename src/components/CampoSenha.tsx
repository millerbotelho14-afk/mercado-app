import { useState } from 'react';

/**
 * Olho desenhado em traço, no lugar do emoji. Emoji muda de desenho conforme o
 * sistema e não acompanha a cor do tema; o traço é igual em todo lugar.
 */
function Olho({ riscado }: { riscado: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.75" />
      {riscado && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  );
}

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
          <Olho riscado={visivel} />
        </button>
      </div>
    </div>
  );
}
