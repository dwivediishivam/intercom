import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Intercom",
  description: "Customer communication for teams that care about the details.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
