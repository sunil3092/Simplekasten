// electron-builder afterPack hook. Without an Apple developer certificate the
// macOS app goes out unsigned, and Apple silicon Macs refuse to start an app
// with no valid signature at all. An ad-hoc signature ("-") costs nothing,
// needs no account, and is enough for the app to launch; Gatekeeper still
// asks the user to confirm the first open. Skipped when a real certificate
// is configured, since electron-builder signs properly after this hook.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.CSC_LINK || process.env.CSC_NAME) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
};
