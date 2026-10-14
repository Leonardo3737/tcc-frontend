'use client';

import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';
import { ArrowBigUp, Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/campo';

/**
 * Campo de senha com exibicao alternavel e aviso de Caps Lock.
 *
 * Duas ajudas que so fazem sentido em campo mascarado:
 *
 *  1. ALTERNAR A EXIBICAO. Quem digita uma senha longa sem ver o que escreveu
 *     erra e nao sabe onde. Aqui isso custa caro: o backend limita o login a 5
 *     tentativas por minuto, entao cada erro evitavel vale.
 *
 *  2. CAPS LOCK. E a causa mais comum de "minha senha parou de funcionar".
 *     Avisar antes do envio poupa uma tentativa do mesmo orcamento.
 *
 * NENHUM dos dois muda o comportamento do formulario: o valor enviado, o `name`
 * e a validacao continuam identicos. Sao affordances visuais.
 *
 * O rotulo do botao evita a palavra "senha" de proposito: `aria-label` tambem e
 * lido por `getByLabelText`, e dois elementos rotulados "senha" tornariam a
 * consulta ambigua — alem de redundante no leitor de tela, ja que o botao esta
 * dentro do campo que o rotulo acabou de nomear.
 */
export interface CampoSenhaProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'type'
> {
  label: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
}

export const CampoSenha = forwardRef<HTMLInputElement, CampoSenhaProps>(function CampoSenha(
  { label, erro, ajuda, obrigatorio, onKeyUp, onBlur, ...props },
  ref,
) {
  const [visivel, setVisivel] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const idAviso = useId();

  return (
    <div className="space-y-1.5">
      <Input
        ref={ref}
        label={label}
        erro={erro}
        ajuda={ajuda}
        obrigatorio={obrigatorio}
        type={visivel ? 'text' : 'password'}
        descritoPor={capsLock ? idAviso : undefined}
        onKeyUp={(evento) => {
          // O optional chaining cobre eventos sinteticos de teste, que nem
          // sempre implementam `getModifierState`.
          setCapsLock(evento.getModifierState?.('CapsLock') ?? false);
          onKeyUp?.(evento);
        }}
        onBlur={(evento) => {
          // Sem isto o aviso ficaria na tela depois de o foco sair do campo.
          setCapsLock(false);
          onBlur?.(evento);
        }}
        sufixo={
          <button
            type="button"
            onClick={() => setVisivel((atual) => !atual)}
            aria-label={visivel ? 'Ocultar caracteres' : 'Mostrar caracteres'}
            aria-pressed={visivel}
            /**
             * Fora da ordem de tabulacao de proposito: partindo da senha, Tab
             * deve chegar ao botao Entrar. Quem precisa do olho o alcanca por
             * ponteiro ou pela navegacao do leitor de tela.
             */
            tabIndex={-1}
            className="flex h-8 w-8 items-center justify-center rounded text-texto-suave transition-colors hover:bg-fundo-suave hover:text-texto"
          >
            {visivel ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        }
        {...props}
      />

      {capsLock && (
        <p
          id={idAviso}
          // `polite`, nao `assertive`: e uma dica util, nao um erro que
          // interrompe o que o leitor de tela esta anunciando.
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-alerta"
        >
          <ArrowBigUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Caps Lock está ativado.
        </p>
      )}
    </div>
  );
});
