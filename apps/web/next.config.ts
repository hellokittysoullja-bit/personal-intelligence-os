import path from "node:path";
import dotenv from "dotenv";
import type { NextConfig } from "next";

// .env лежит в корне монорепозитория, не в apps/web — Next.js по умолчанию
// ищет .env только в своей собственной директории, поэтому грузим явно
// (тот же приём, что и в apps/api/apps/worker, см. docs/DEVELOPMENT.md §7).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lint идёт отдельным шагом (turbo run lint, единый корневой eslint.config.js) —
  // не дублируем его внутри `next build` со своей конфигурацией.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
