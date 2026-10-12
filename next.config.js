/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Câmera só na própria origem; microfone e geolocalização nunca.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // PGlite (Postgres em WebAssembly) precisa ser carregado do node_modules, sem bundling.
    serverComponentsExternalPackages: ["@electric-sql/pglite"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // O link do convite carrega um segredo no caminho: nunca enviar como Referer.
      { source: "/convite/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/acompanhamento/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

module.exports = nextConfig;
