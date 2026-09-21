/**
 * Verificacoes de BOOT do servidor.
 *
 * O Next executa `register()` uma unica vez, quando o processo do servidor sobe —
 * que e o momento certo para conferir a configuracao: aqui o ambiente ja e o
 * real, diferente do `next build`, que roda com NODE_ENV=production na maquina
 * de quem compila.
 *
 * A politica e falhar alto: uma aplicacao no ar com cookie inseguro funciona
 * perfeitamente e so denuncia o problema numa auditoria. Preferimos nao subir.
 */
export async function register(): Promise<void> {
  // O runtime Edge (middleware) tambem passa por aqui, mas nao carrega o modulo
  // de env — a checagem so faz sentido no processo Node.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { problemasDePoliticaDeProducao, ehProducao, env } = await import('./config/env');

  const problemas = problemasDePoliticaDeProducao();

  if (problemas.length > 0) {
    throw new Error(
      `Configuracao invalida para producao:\n${problemas.map((p) => `  - ${p}`).join('\n')}`,
    );
  }

  // Log de boot mínimo: confirma para onde a aplicação está apontando, sem
  // imprimir nenhum segredo (não há nenhum aqui — a URL da API não é secreta).
  console.info(
    `[monitoria] frontend iniciado · ambiente=${env.NODE_ENV} · api=${env.API_URL} · ` +
      `cookieSecure=${env.COOKIE_SECURE}${ehProducao ? '' : ' (desenvolvimento)'}`,
  );
}
