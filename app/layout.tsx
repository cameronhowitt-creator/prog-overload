import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./ui.css";

export const metadata: Metadata = {
  title: "Progressive Overload",
  description:
    "Progressive-overload strength programming, live logging, and PR tracking.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Overload",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Apply saved theme before paint to avoid a flash (PRD §9 dark-mode gap). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
