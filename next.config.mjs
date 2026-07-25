import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the tracing root to this project (a stray parent lockfile confuses the
  // default inference).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
