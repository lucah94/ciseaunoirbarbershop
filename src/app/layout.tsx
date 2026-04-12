import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import JsonLd from "@/components/JsonLd";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { LanguageProvider } from "@/lib/language-context";
import "@/lib/env";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ciseaunoir.ca"),
  title: {
    default: "Ciseau Noir | Barbershop Beauport Québec",
    template: "%s — Ciseau Noir Barbershop Beauport",
  },
  description:
    "Barbier à Beauport, Québec. Coupes homme, rasage et taille de barbe au 375 Boul. des Chutes. Melynda & Diodis. Réservez en ligne.",
  keywords: [
    "barbier Beauport",
    "barbershop Beauport",
    "barbier Québec",
    "coupe homme Beauport",
    "rasage Beauport",
    "barbe Québec",
    "Ciseau Noir",
    "375 boulevard des Chutes",
  ],
  authors: [{ name: "Ciseau Noir Barbershop" }],
  creator: "Ciseau Noir Barbershop",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: "/icon-192.png",
    shortcut: "/icon.png",
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    siteName: "Ciseau Noir Barbershop",
    title: "Ciseau Noir | Barbershop Beauport Québec",
    description:
      "Barbier à Beauport, Québec. Coupes homme, rasage et taille de barbe. Réservez en ligne.",
    url: "https://ciseaunoir.ca",
  },
  twitter: {
    card: "summary",
    title: "Ciseau Noir | Barbershop Beauport Québec",
    description:
      "Barbier à Beauport, Québec. Réservez en ligne.",
  },
  alternates: {
    canonical: "https://ciseaunoir.ca",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd />
        <ServiceWorkerRegister />
        <LanguageProvider>
        {children}
        </LanguageProvider>
        {GA_ID && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}</Script>
          </>
        )}
      </body>
    </html>
  );
}
