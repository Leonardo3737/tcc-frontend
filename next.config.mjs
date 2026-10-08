/**
 * Configuracao do Next.js.
 *
 * `output: 'standalone'` deixa o build de producao autocontido (util para
 * conteinerizar sem arrastar node_modules inteiro).
 *
 * Os cabecalhos de seguranca sao o espelho do que o backend ja faz com helmet.
 * Nao ha CSP aqui de proposito: definir uma CSP correta exige nonce por request,
 * e uma CSP frouxa ("unsafe-inline") daria falsa sensacao de protecao. Fica
 * registrado como proximo passo de endurecimento.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  // O indicador de desenvolvimento ficaria sobre o bloco da conta, no rodape
  // da sidebar. So existe em `next dev`.
  devIndicators: { position: 'bottom-right' },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
