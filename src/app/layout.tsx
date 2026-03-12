import type { Metadata, Viewport } from 'next';
import './globals.css';
import './nutri.css';

export const metadata: Metadata = {
    title: 'NutriAI — Tu asistente nutricional inteligente',
    description: 'Calculá tus macros personalizados con IA, registrá comidas por voz y foto.',
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'NutriAI',
    },
};

export const viewport: Viewport = {
    themeColor: '#0d1117',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
      <html lang="es">
        <body>
          <div className="nutri-app">
              {children}
          </div>
        </body>
      </html>
    );
}
