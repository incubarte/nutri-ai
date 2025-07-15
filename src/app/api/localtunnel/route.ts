
import { NextResponse } from 'next/server';
import localtunnel, { type Tunnel } from 'localtunnel';

// Mantener una referencia global al túnel activo.
// Esto es importante porque los módulos de Next.js pueden ser recargados en desarrollo.
const globalForTunnel = globalThis as unknown as {
  activeTunnel: Tunnel | undefined;
};

// --- Helper para generar el subdominio ---
import defaults from '@/config/defaults.json';
const getDynamicSubdomain = () => {
  const prefix = defaults.tunnel.subdomainPrefix || 'icevision-fs';
  const randomNumber = Math.floor(10000 + Math.random() * 90000); // 5-digit random number
  return `${prefix}-${randomNumber}`;
};


export async function POST(request: Request) {
  const { action, port } = await request.json();

  if (action === 'connect') {
    if (globalForTunnel.activeTunnel) {
      return NextResponse.json({ success: false, message: 'Ya existe un túnel activo.' }, { status: 400 });
    }
    if (!port) {
      return NextResponse.json({ success: false, message: 'El puerto es requerido.' }, { status: 400 });
    }

    const dynamicSubdomain = getDynamicSubdomain();

    try {
      const tunnel = await localtunnel({ port: Number(port), subdomain: dynamicSubdomain });
      globalForTunnel.activeTunnel = tunnel;

      console.log(`Localtunnel abierto en: ${tunnel.url}`);

      tunnel.on('close', () => {
        console.log('Túnel cerrado.');
        globalForTunnel.activeTunnel = undefined;
        // Podrías usar un webhook o un event emitter aquí para notificar al frontend.
      });

      tunnel.on('error', (err) => {
        // Silently log the error on the server if needed, but don't console.error to avoid noise
        // console.log('Error en el túnel:', err);
        globalForTunnel.activeTunnel = undefined;
      });

      return NextResponse.json({ success: true, url: tunnel.url, subdomain: dynamicSubdomain });

    } catch (error: any) {
      // Don't log to console to avoid noise, just return the error message.
      // console.error('Error al crear el túnel:', error);
      globalForTunnel.activeTunnel = undefined;
      return NextResponse.json({ success: false, message: error.message || 'Error desconocido al iniciar el túnel.' }, { status: 500 });
    }

  } else if (action === 'disconnect') {
    if (globalForTunnel.activeTunnel) {
      globalForTunnel.activeTunnel.close();
      globalForTunnel.activeTunnel = undefined;
      return NextResponse.json({ success: true, message: 'Túnel desconectado.' });
    } else {
      return NextResponse.json({ success: false, message: 'No hay ningún túnel activo para desconectar.' }, { status: 400 });
    }
  } else if (action === 'status') {
     if (globalForTunnel.activeTunnel) {
        // Extraer el subdominio de la URL para devolverlo
        const urlParts = new URL(globalForTunnel.activeTunnel.url);
        const subdomain = urlParts.hostname.split('.')[0];
        return NextResponse.json({ success: true, status: 'connected', url: globalForTunnel.activeTunnel.url, subdomain });
     } else {
        return NextResponse.json({ success: true, status: 'disconnected', url: null, subdomain: null });
     }
  }

  return NextResponse.json({ success: false, message: 'Acción no válida.' }, { status: 400 });
}
