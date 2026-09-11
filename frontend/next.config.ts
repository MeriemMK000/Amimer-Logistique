import type { NextConfig } from "next";

// Cible du backend NestJS (surchargée par BACKEND_ORIGIN si besoin).
const BACKEND = process.env.BACKEND_ORIGIN || "http://localhost:3011";

const nextConfig: NextConfig = {
  // Le front appelle "/api/*" en relatif → Next proxifie vers le backend.
  // Résultat : une seule URL/port à exposer publiquement (partage de port),
  // pas de CORS, pas de "localhost:3011" en dur côté navigateur.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND}/api/:path*` },
    ];
  },
};

export default nextConfig;
