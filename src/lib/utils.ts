import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes resolvendo conflitos do Tailwind.
 *
 * Sem o twMerge, `cn('p-2', 'p-4')` produziria as duas classes e o resultado
 * dependeria da ordem no CSS gerado — o que quebra a sobrescrita por prop em
 * componentes do design system.
 */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}

/** Iniciais para avatar textual. "Ana Martins Souza" -> "AS". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';

  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';

  return `${primeira}${ultima}`.toUpperCase();
}
