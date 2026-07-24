import type { Metadata, Viewport } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./globals.css";
import { SITE } from "./_lib/site";
import { StructuredData } from "./_components/seo/structured-data";

const TITLE = `${SITE.name} — AI Bible verse detection for live sermons`;
const OG_TITLE = `${SITE.name} — ${SITE.tagline}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: TITLE,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.shortDescription,
  applicationName: SITE.name,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: [
    "Bible verse detection",
    "real-time scripture overlay",
    "sermon transcription",
    "church broadcast software",
    "NDI overlay",
    "live scripture display",
    "church media",
    "AI Bible verse finder",
    "sermon AI",
    "live sermon scripture",
    "OBS scripture overlay",
    "vMix scripture overlay",
    "church livestream tools",
    "speech-to-scripture",
    SITE.name,
  ],
  authors: [{ name: SITE.legalName, url: SITE.repo.url }],
  creator: SITE.legalName,
  publisher: SITE.legalName,
  category: "Religion",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    title: OG_TITLE,
    description: SITE.description,
    siteName: SITE.name,
    url: SITE.url,
    locale: SITE.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: SITE.description,
    site: SITE.twitterHandle,
    creator: SITE.twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Favicon and apple touch icon are wired from app/icon.png.
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f5f7fa",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      data-theme="light"
      suppressHydrationWarning
    >
      <body
        className="min-h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        <StructuredData />
        <RootProvider
          theme={{
            defaultTheme: "light",
            forcedTheme: "light",
            enableSystem: false,
          }}
          search={{
            options: {
              type: "static",
            },
          }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
