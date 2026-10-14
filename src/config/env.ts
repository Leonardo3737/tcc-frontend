import { z } from 'zod';

/**
 * Validacao das variaveis de ambiente do SERVIDOR, no mesmo espirito do Joi do
 * backend: falhar no boot, alto e claro, em vez de descobrir em producao que
 * API_URL estava vazia e toda requisicao ia para "undefined/monitorias".
 *
 * Nenhuma variavel tem prefixo NEXT_PUBLIC_ de proposito. O navegador nunca fala
 * com o backend diretamente — ele passa pelo proxy /api/backend — entao a URL do
 * backend nao precisa (e nao deve) ser embutida no bundle do cliente.
 */
const esquemaEnv = z.object({
  API_URL: z
    .string()
    .url('API_URL deve ser uma URL valida, incluindo o prefixo /api do backend')
    .transform((url) => url.replace(/\/+$/, '')),

  SESSAO_COOKIE_NOME: z.string().min(1).default('monitoria_sessao'),

  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function carregar() {
  const resultado = esquemaEnv.safeParse(process.env);

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
      .join('\n');

    throw new Error(
      `Variaveis de ambiente invalidas:\n${problemas}\n\n` +
        'Copie .env.example para .env.local e preencha os valores.',
    );
  }

  return resultado.data;
}

export const env = carregar();

export const ehProducao = env.NODE_ENV === 'production';

/**
 * Politica de PRODUCAO, verificada no BOOT — nao no build.
 *
 * A distincao importa: `next build` roda com NODE_ENV=production na maquina de
 * quem compila, que normalmente tem a configuracao de desenvolvimento. Validar
 * a politica no carregamento do modulo quebraria o build sem que houvesse
 * problema algum no ambiente real.
 *
 * Chamada por `instrumentation.ts`, que o Next executa uma vez quando o servidor
 * sobe — o momento em que o ambiente ja e o de verdade.
 *
 * Devolve os problemas em vez de lançar, para que o chamador decida (o
 * instrumentation lança; os testes apenas inspecionam).
 */
export function problemasDePoliticaDeProducao(valores = env): string[] {
  if (valores.NODE_ENV !== 'production') return [];

  const problemas: string[] = [];

  /**
   * Sem `Secure`, o cookie de sessao trafega tambem em HTTP puro: qualquer
   * intermediario na rede o le, e todo o padrao BFF — que existe justamente
   * para o token nunca ficar exposto — perde o sentido. E uma falha silenciosa:
   * a aplicacao funciona normalmente, e o defeito so apareceria numa auditoria.
   */
  if (!valores.COOKIE_SECURE) {
    problemas.push(
      'COOKIE_SECURE=false: o cookie de sessao iria sem a flag Secure, expondo o token em HTTP. ' +
        'Defina COOKIE_SECURE=true (a aplicacao precisa ser servida por HTTPS).',
    );
  }

  if (/localhost|127\.0\.0\.1/.test(valores.API_URL)) {
    problemas.push(`API_URL aponta para ${valores.API_URL}. Configure o endereco real do backend.`);
  }

  return problemas;
}
