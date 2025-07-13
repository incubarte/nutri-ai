
import { NextResponse } from 'next/server';
import puppeteer, { type Browser } from 'puppeteer-core';

const LAUNCH_OPTIONS = {
    executablePath: '/usr/bin/google-chrome', 
    headless: false,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certifcate-errors',
        '--ignore-certifcate-errors-spki-list',
        '--kiosk'
    ],
};

const globalForPuppeteer = globalThis as unknown as {
  browser: Browser | undefined;
};

async function launchBrowser(x: number = 0, y: number = 0) {
    if (globalForPuppeteer.browser) {
        return globalForPuppeteer.browser;
    }
    
    const options = { ...LAUNCH_OPTIONS };
    const windowPositionArgIndex = options.args.findIndex(arg => arg.startsWith('--window-position'));
    if (windowPositionArgIndex !== -1) {
        options.args[windowPositionArgIndex] = `--window-position=${x},${y}`;
    } else {
        options.args.push(`--window-position=${x},${y}`);
    }

    try {
        const browser = await puppeteer.launch(options);
        globalForPuppeteer.browser = browser;

        browser.on('disconnected', () => {
            console.log('Browser disconnected.');
            globalForPuppeteer.browser = undefined;
        });

        return browser;
    } catch (error) {
        console.error("Failed to launch Puppeteer:", error);
        throw new Error("Could not launch browser instance.");
    }
}

async function closeBrowser() {
    if (globalForPuppeteer.browser) {
        await globalForPuppeteer.browser.close();
        globalForPuppeteer.browser = undefined;
        console.log("Browser instance closed.");
        return true;
    }
    return false;
}

export async function POST(request: Request) {
  const { action, x, y } = await request.json();

  if (action === 'open') {
    try {
        const browser = await launchBrowser(x, y);
        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();
        
        await page.setViewport({ width: 1920, height: 1080 });
        const url = new URL('/', request.url).toString();
        await page.goto(url, { waitUntil: 'networkidle0' });

        return NextResponse.json({ success: true, message: 'Scoreboard window opened in kiosk mode.' });
    } catch (error) {
        console.error("Puppeteer Open Error:", error);
        return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
    }
  } else if (action === 'close') {
    try {
        const closed = await closeBrowser();
        if (closed) {
            return NextResponse.json({ success: true, message: 'Browser instance closed.' });
        } else {
            return NextResponse.json({ success: false, message: 'No active browser instance to close.' });
        }
    } catch (error) {
        console.error("Puppeteer Close Error:", error);
        return NextResponse.json({ success: false, message: (error as Error).message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: false, message: 'Invalid action.' }, { status: 400 });
}
