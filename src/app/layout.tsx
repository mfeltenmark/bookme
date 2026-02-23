import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BookMe – Book a meeting with Mikael Feltenmark",
  description: "Pick a time that works for you and book a meeting directly.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
