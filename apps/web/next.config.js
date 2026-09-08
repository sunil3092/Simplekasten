/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: no Node runtime required, so this same build works inside
  // Tauri's webview and behind any static file host — no server features
  // (Server Components, Server Actions, API routes) are used anywhere in this
  // app on purpose; every screen talks to the Express API over tRPC instead.
  output: "export",
  images: { unoptimized: true },
};

module.exports = nextConfig;
