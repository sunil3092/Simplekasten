/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: no Node runtime required, so Electron can load this as
  // plain files off disk. No server features (Server Components, Server
  // Actions, API routes) are used anywhere in this app — every screen talks
  // to the Electron main process over IPC instead (see ../lib/vaultClient.ts).
  output: "export",
  images: { unoptimized: true },
};

module.exports = nextConfig;
