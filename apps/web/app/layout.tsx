import Workspace from "./workspace";
import type { Metadata } from "next";
import "./globals.css";
import "./ums.css";
import { LanguageProvider } from "./components/i18n";
export const metadata: Metadata = {
  authors: [{ name: "Raditte Anggoro" }],
  creator: "Raditte Anggoro",
  other: { "ums:provenance": "RA.ONEUMS.2026.10" },
  title: "UMS — Unified Messaging Workspace",
  description: "Kampanye, persetujuan, dan biaya pesan dalam satu tempat.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <LanguageProvider>
          <Workspace />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
