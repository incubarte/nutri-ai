import type { Metadata, Viewport } from 'next';
import '../globals.css';
import './nutri.css';

export const metadata: Metadata = {
    title: 'NutriAI — Tu asistente nutricional inteligente',
    description: 'Calculá tus macros personalizados con IA, registrá comidas por voz y foto, y seguí tu progreso diario y semanal.',
    manifest: '/nutri-manifest.json',
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

export default function NutriLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="nutri-app">
            {children}
        </div>
    );
}
