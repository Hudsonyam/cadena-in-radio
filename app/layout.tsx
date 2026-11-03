import type { Metadata } from "next";
import "./globals.css";
import "./coverage.css";
import "./theme.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "Cadena IN | Informe a la hora",
  description: "Generador de cortes breves de Puebla, México, noticias internacionales, espectáculos, clima y deportes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
