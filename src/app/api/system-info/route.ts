
import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  try {
    const platform = os.platform();
    let defaultBrowserPath = '';

    switch (platform) {
      case 'linux':
        // Asumiendo Arch como un caso común, pero podría ser /usr/bin/google-chrome en otros.
        defaultBrowserPath = '/opt/google/chrome/google-chrome';
        break;
      case 'darwin': // macOS
        defaultBrowserPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        break;

      case 'win32': // Windows
        defaultBrowserPath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        break;
      
      default:
        defaultBrowserPath = 'google-chrome'; // Un fallback genérico
    }

    return NextResponse.json({
      os: platform,
      defaultBrowserPath: defaultBrowserPath
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido.';
    console.error("Error fetching system info:", error);
    return NextResponse.json({ error: `Error interno del servidor: ${errorMessage}` }, { status: 500 });
  }
}

