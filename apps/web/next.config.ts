import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint идёт отдельным шагом (turbo run lint, единый корневой eslint.config.js) —
  // не дублируем его внутри `next build` со своей конфигурацией.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
