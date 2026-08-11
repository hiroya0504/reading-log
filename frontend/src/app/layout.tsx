import type { Metadata } from "next";
import "./globals.css";

// Deliberately no next/font/google: it fetches from the network at build time, which makes
// `make build` (and therefore CI) depend on an external host. System fonts keep the build hermetic.

export const metadata: Metadata = {
  title: "reading-log",
  description: "読んだ本を記録する",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
