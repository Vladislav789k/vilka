import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "next-themes";

export const metadata: Metadata = {
  title: "Вилка — быстрая доставка еды и продуктов",
  description:
    "Вилка — онлайн-сервис быстрой доставки еды и продуктов. Собираем за минуты, привозим в удобное время.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Migrate "system" theme to "light" if present
                  const savedTheme = localStorage.getItem('theme');
                  if (savedTheme === 'system' || savedTheme === null || savedTheme === undefined) {
                    localStorage.setItem('theme', 'light');
                  }
                } catch (e) {
                  // Ignore errors (e.g., in SSR or if localStorage is not available)
                }
              })();
            `,
          }}
        />
        <Script
          id="cursor-ingest-suppress"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Check if running in Cursor WebView
                const isCursor = typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Cursor');
                
                // Check if suppression is disabled via env var (injected at build time)
                // Default: enabled (true) unless NEXT_PUBLIC_SUPPRESS_CURSOR_INGEST is set to "0"
                const suppressEnv = ${process.env.NEXT_PUBLIC_SUPPRESS_CURSOR_INGEST !== "0"};
                
                if (!isCursor || !suppressEnv) {
                  return;
                }
                
                // Monkey-patch window.fetch to silently short-circuit Cursor ingest requests
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
                  
                  // Check if this is a Cursor ingest request
                  if (url && (url.includes('127.0.0.1:7242/ingest/') || url.includes('localhost:7242/ingest/'))) {
                    // Silently return a successful empty response
                    return Promise.resolve(new Response('', { status: 204 }));
                  }
                  
                  // For all other requests, use the original fetch
                  return originalFetch.apply(this, args);
                };
                
                // Optionally monkey-patch navigator.sendBeacon as well
                if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                  const originalSendBeacon = navigator.sendBeacon;
                  navigator.sendBeacon = function(url, data) {
                    if (url && (url.includes('127.0.0.1:7242/ingest/') || url.includes('localhost:7242/ingest/'))) {
                      return true; // Silently return success
                    }
                    return originalSendBeacon.apply(this, arguments);
                  };
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen w-full bg-background text-foreground">
        <ThemeProvider 
          attribute="class" 
          defaultTheme="light" 
          enableSystem={false} 
          storageKey="theme"
          themes={["light", "dark"]}
        >
          <div className="flex min-h-screen w-full flex-col bg-transparent">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
