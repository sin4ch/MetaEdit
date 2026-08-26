import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetaEdit — Edit software from inside the software",
  description: "Collaborative in-app development workspace powered by WebMCP and Codex.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
