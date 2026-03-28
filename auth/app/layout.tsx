import { ToastProvider } from "@/components/ui/toast-provider";
import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "cyrillic-ext"],
  display: "swap",
  variable: "--font-plus-jakarta",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "BilimMentor",
    template: "%s | BilimMentor",
  },
  description:
    "BilimMentor - платформа для обучения: курсы, задания, практика и контроль прогресса для студентов и преподавателей.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BilimMentor",
    description:
      "Платформа для онлайн-обучения: курсы, задания, уроки и контроль прогресса.",
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: "BilimMentor",
  },
  twitter: {
    card: "summary_large_image",
    title: "BilimMentor",
    description:
      "Платформа для онлайн-обучения: курсы, задания, уроки и контроль прогресса.",
  },
  icons: {
    icon: "/brand/bm-icon.svg",
    shortcut: "/brand/bm-icon.svg",
    apple: "/brand/bm-icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${plusJakarta.variable} font-plus-jakarta`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
