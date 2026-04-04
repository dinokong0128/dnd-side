import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Realm & Ruin — D&D Multiplayer",
  description: "A multiplayer D&D adventure where Claude is your Dungeon Master",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
