import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppNav } from "@/components/app-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "IdeaProof",
  description: "Generate concise idea documents and timestamp approved PDFs.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppNav />
        <main id="main-content">{children}</main>
      </body>
    </html>
  );
}
