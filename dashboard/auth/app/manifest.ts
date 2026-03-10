import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BilimMentor",
    short_name: "BilimMentor",
    description: "Платформа для онлайн-обучения и отслеживания прогресса",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#0f172a",
    lang: "ru",
    icons: [
      {
        src: "/brand/bm-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
