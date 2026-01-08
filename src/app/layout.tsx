import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="ru">
      <body className="min-h-screen bg-[var(--vilka-bg)]">
        <div className="flex min-h-screen flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
