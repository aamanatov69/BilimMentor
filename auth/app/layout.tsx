import "katex/dist/katex.min.css";
import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
