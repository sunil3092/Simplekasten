/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: no Node runtime required, so Electron can load this as
  // plain files off disk. No server features (Server Components, Server
  // Actions, API routes) are used anywhere in this app — every screen talks
  // to the Electron main process over IPC instead (see ../lib/vaultClient.ts).
  output: "export",
  // The packaged app loads out/index.html over file://, where a leading-slash
  // "/_next/..." resolves against the filesystem root and yields a blank
  // window. Relative asset paths are what make the export loadable off disk.
  assetPrefix: "./",
  images: { unoptimized: true },
};

module.exports = nextConfig;
