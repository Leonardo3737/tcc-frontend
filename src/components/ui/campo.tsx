import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Campos de formulario com acessibilidade embutida.
 *
 * O padrao aqui e o que evita o erro mais comum em formularios: erro visivel
 * apenas por cor. Cada campo amarra label, mensagem de erro e texto de ajuda via
 * `aria-describedby` e marca `aria-invalid`, para que leitor de tela anuncie o
 * problema junto com o campo. Vale para os tres controles.
 */

const CLASSE_CONTROLE =
  'w-full rounded-lg border bg-superficie px-3 py-2 text-sm text-texto shadow-sm transition-colors ' +
  'placeholder:text-texto-suave/70 disabled:cursor-not-allowed disabled:opacity-60';

function classesControle(temErro: boolean): string {
  return cn(
    CLASSE_CONTROLE,
    temErro ? 'border-perigo focus-visible:ring-perigo' : 'border-borda hover:border-texto-suave/50',
  );
}

interface PropsBaseCampo {
  label: string;
  erro?: string;
  ajuda?: string;
  obrigatorio?: boolean;
  className?: string;
}

function EnvelopeCampo({
  label,
  erro,
  ajuda,
  obrigatorio,
  idControle,
  idErro,
  idAjuda,
  className,
  children,
}: PropsBaseCampo & {
  idControle: string;
  idErro: string;
  idAjuda: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={idControle} className="block text-sm font-medium text-texto">
        {label}
        {obrigatorio && (
          <span className="ml-0.5 text-perigo" aria-hidden>
            *
          </span>
        )}
      </label>

      {children}

      {ajuda && !erro && (
        <p id={idAjuda} className="text-xs text-texto-suave">
          {ajuda}
        </p>
      )}

      {/* role="alert" faz o leitor de tela anunciar assim que o erro aparece. */}
      {erro && (
        <p id={idErro} role="alert" className="flex items-center gap-1.5 text-xs text-perigo">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {erro}
        </p>
      )}
    </div>
  );
}

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>,
    PropsBaseCampo {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, erro, ajuda, obrigatorio, className, id, ...props },
  ref,
) {
  const gerado = useId();
  const idControle = id ?? gerado;
  const idErro = `${idControle}-erro`;
  const idAjuda = `${idControle}-ajuda`;

  return (
    <EnvelopeCampo
      label={label}
      erro={erro}
      ajuda={ajuda}
      obrigatorio={obrigatorio}
      idControle={idControle}
      idErro={idErro}
      idAjuda={idAjuda}
      className={className}
    >
      <input
        ref={ref}
        id={idControle}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : ajuda ? idAjuda : undefined}
        aria-required={obrigatorio || undefined}
        className={cn(classesControle(Boolean(erro)), 'alvo-toque')}
        {...props}
      />
    </EnvelopeCampo>
  );
});

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>,
    PropsBaseCampo {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, erro, ajuda, obrigatorio, className, id, rows = 4, ...props },
  ref,
) {
  const gerado = useId();
  const idControle = id ?? gerado;
  const idErro = `${idControle}-erro`;
  const idAjuda = `${idControle}-ajuda`;

  return (
    <EnvelopeCampo
      label={label}
      erro={erro}
      ajuda={ajuda}
      obrigatorio={obrigatorio}
      idControle={idControle}
      idErro={idErro}
      idAjuda={idAjuda}
      className={className}
    >
      <textarea
        ref={ref}
        id={idControle}
        rows={rows}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : ajuda ? idAjuda : undefined}
        aria-required={obrigatorio || undefined}
        className={cn(classesControle(Boolean(erro)), 'resize-y')}
        {...props}
      />
    </EnvelopeCampo>
  );
});

export interface OpcaoSelect {
  valor: string;
  rotulo: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'>,
    PropsBaseCampo {
  opcoes: OpcaoSelect[];
  placeholder?: string;
}

/**
 * Select nativo, por decisao.
 *
 * Um combobox customizado (Radix Select e afins) so se justificaria com busca
 * dentro da lista ou opcao com layout rico. Para escolher modalidade, papel ou
 * status, o `<select>` nativo ganha: abre o seletor do sistema no celular,
 * funciona com teclado sem codigo nosso e nao adiciona dependencia.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, erro, ajuda, obrigatorio, className, id, opcoes, placeholder, ...props },
  ref,
) {
  const gerado = useId();
  const idControle = id ?? gerado;
  const idErro = `${idControle}-erro`;
  const idAjuda = `${idControle}-ajuda`;

  return (
    <EnvelopeCampo
      label={label}
      erro={erro}
      ajuda={ajuda}
      obrigatorio={obrigatorio}
      idControle={idControle}
      idErro={idErro}
      idAjuda={idAjuda}
      className={className}
    >
      <select
        ref={ref}
        id={idControle}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : ajuda ? idAjuda : undefined}
        aria-required={obrigatorio || undefined}
        className={cn(classesControle(Boolean(erro)), 'alvo-toque')}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </EnvelopeCampo>
  );
});
