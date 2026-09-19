import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "../lib/ThemeProvider";

export const metadata = {
  title: "Simplekasten",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Relative href so it resolves both under `next dev` and from
            out/index.html over file:// in the packaged app. */}
        <link rel="stylesheet" href="./fonts/fonts.css" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
