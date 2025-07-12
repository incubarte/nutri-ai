
import { NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer';

// Mantener una referencia global al navegador para no abrir múltiples instancias.
// Esto es importante porque los módulos de Next.js pueden ser recargados en desarrollo.
const globalForBrowser = globalThis as unknown as {
  browser: Browser | undefined;
};

// --- ADVERTENCIA DE ENTORNO ---
// Puppeteer requiere un entorno de servidor Node.js completo.
// NO funcionará en entornos de vista previa o serverless estándar de Firebase App Hosting.
// Está diseñado para ser ejecutado en un servidor local o en un contenedor personalizado.
const isPuppeteerSupported = !process.env.FIREBASE_APP_HOSTING_PREVIEW_URL;


export async function POST(request: Request) {
  if (!isPuppeteerSupported) {
    return NextResponse.json({ 
        success: false, 
        message: 'Puppeteer no es compatible con este entorno de servidor.' 
    }, { status: 501 });
  }

  const { action, url, secondMonitorX, secondMonitorY } = await request.json();

  if (action === 'open') {
    if (globalForBrowser.browser) {
      return NextResponse.json({ success: false, message: 'La ventana del scoreboard ya está abierta.' }, { status: 400 });
    }
    if (!url) {
      return NextResponse.json({ success: false, message: 'La URL es requerida para abrir la ventana.' }, { status: 400 });
    }

    try {
      const browser = await puppeteer.launch({
        headless: false,
        args: [
          '--start-fullscreen',
          '--kiosk', // Modo kiosco, oculta la UI de Chrome
          `--window-position=${secondMonitorX || 0},${secondMonitorY || 0}`, // Intenta posicionar en el segundo monitor
        ],
      });

      globalForBrowser.browser = browser;

      const page = await browser.newPage();
      await page.goto(url);

      browser.on('disconnected', () => {
        console.log('Navegador de Puppeteer cerrado.');
        globalForBrowser.browser = undefined;
      });

      return NextResponse.json({ success: true, message: 'Scoreboard abierto en modo kiosco.' });
    } catch (error: any) {
      console.error('Error al lanzar Puppeteer:', error);
      globalForBrowser.browser = undefined;
      return NextResponse.json({ success: false, message: error.message || 'Error desconocido al iniciar Puppeteer.' }, { status: 500 });
    }

  } else if (action === 'close') {
    if (globalForBrowser.browser) {
      await globalForBrowser.browser.close();
      globalForBrowser.browser = undefined;
      return NextResponse.json({ success: true, message: 'Scoreboard cerrado.' });
    } else {
      return NextResponse.json({ success: false, message: 'No hay ninguna ventana de scoreboard activa para cerrar.' }, { status: 400 });
    }
  } else if (action === 'status') {
     if (globalForBrowser.browser && globalForBrowser.browser.isConnected()) {
        return NextResponse.json({ success: true, status: 'open' });
     } else {
        // Limpieza por si el navegador se cerró externamente
        globalForBrowser.browser = undefined;
        return NextResponse.json({ success: true, status: 'closed' });
     }
  }


  return NextResponse.json({ success: false, message: 'Acción no válida.' }, { status: 400 });
}
