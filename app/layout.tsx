import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";

import "./globals.css";

const plexSans = localFont({
  src: [
    {
      path: "../assets/fonts/IBMPlexSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/IBMPlexSans-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = localFont({
  src: "../assets/fonts/IBMPlexMono-Regular.ttf",
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IdeaProof",
  description: "Generate concise idea documents and timestamp approved PDFs.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${plexSans.variable} ${plexMono.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppNav />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
