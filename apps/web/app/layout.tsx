import type { Metadata } from "next";
import "./globals.css";
import "./ums.css";
export const metadata: Metadata = {
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
      <body>{children}</body>
    </html>
  );
}
