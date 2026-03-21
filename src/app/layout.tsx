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
    default: "Ciseau Noir — Barbershop Québec",
    template: "%s — Ciseau Noir Barbershop",
  },
  description:
    "Salon de barbier premium à Québec. Coupes, rasages et soins professionnels au 375 Boul. des Chutes. Réservez en ligne.",
  keywords: [
    "barbier",
    "barber",
    "coiffeur",
    "Québec",
    "coupe homme",
    "rasage",
    "barbe",
    "Ciseau Noir",
  ],
  authors: [{ name: "Ciseau Noir Barbershop" }],
  creator: "Ciseau Noir Barbershop",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "fr_CA",
    siteName: "Ciseau Noir Barbershop",
    title: "Ciseau Noir — Barbershop Québec",
    description:
      "Salon de barbier premium à Québec. Coupes, rasages et soins professionnels. Réservez en ligne.",
    url: "https://ciseaunoir.ca",
  },
  twitter: {
    card: "summary",
    title: "Ciseau Noir — Barbershop Québec",
    description:
      "Salon de barbier premium à Québec. Réservez en ligne.",
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
