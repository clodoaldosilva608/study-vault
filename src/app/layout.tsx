import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SimpleToaster } from '@/components/common/simple-toast';
import { Providers } from '@/components/providers';

const inter = Inter({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Study Vault — Personal Knowledge Infrastructure',
  description:
    'Multi-tenant study & knowledge platform. Files, folders, notes, Obsidian sync foundation, and a secure JARVIS AI tool layer.',
  applicationName: 'Study Vault',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Study Vault',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0b0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// Inline script that patches removeChild BEFORE any React code runs.
// This must execute synchronously in <head> to prevent the DOM
// reconciliation error from ever reaching React.
const domPatchScript = `(function(){
  if (typeof Node === 'undefined') return;
  var origRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function(child) {
    try { return origRemoveChild.call(this, child); }
    catch (e) {
      if (e && e.name === 'NotFoundError') return child;
      throw e;
    }
  };
  var origRemove = Element.prototype.remove;
  Element.prototype.remove = function() {
    try { return origRemove.call(this); }
    catch (e) {
      if (e && e.name === 'NotFoundError') return;
      throw e;
    }
  };
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: domPatchScript }} />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <Providers>
          {children}
          <SimpleToaster />
        </Providers>
      </body>
    </html>
  );
}
