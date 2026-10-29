import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Noticiero — Una perspectiva propia",
  description:
    "Tu briefing personal de tecnología, empresas y oportunidades de negocio. Noticias globales, contexto en español.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        <a href="#main-content" className="skip-link">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
