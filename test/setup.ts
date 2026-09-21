import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * Setup global dos testes.
 *
 * `cleanup` entre testes evita que um componente montado vaze para o proximo —
 * a causa mais comum de teste que passa sozinho e falha na suite.
 */
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/**
 * `matchMedia` e `ResizeObserver` nao existem no jsdom e sao usados pelo Radix
 * (dialog, dropdown). Sem estes stubs, montar qualquer dialogo quebra.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (consulta: string) => ({
    matches: false,
    media: consulta,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }),
});

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// O Radix usa estes dois ao posicionar overlays; o jsdom não os implementa.
globalThis.DOMRect = class {
  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {}
  top = 0;
  left = 0;
  right = 0;
  bottom = 0;
  toJSON() {
    return {};
  }
  static fromRect() {
    return new DOMRect();
  }
} as unknown as typeof DOMRect;

Element.prototype.scrollIntoView = vi.fn();
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
}
