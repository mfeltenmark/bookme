import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMe – Boka möte med Mikael Feltenmark",
  description: "Välj en tid som passar dig och boka ett möte direkt.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
