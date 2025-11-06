
import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import type { drive_v3 } from 'googleapis';

const KEYFILE_PATH = path.join(process.cwd(), 'env_drive_credentials.json');
const DATA_DIR = path.join(process.cwd(), 'src/data');
const SYNC_LOG_PATH = path.join(DATA_DIR, 'sync.log');
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

// --- Google Drive API Client Setup ---
async function getDriveClient(): Promise<drive_v3.Drive> {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: KEYFILE_PATH,
            scopes: SCOPES,
        });
        const authClient = await auth.getClient();
        return google.drive({ version: 'v3', auth: authClient });
    } catch (error) {
        console.error("[SyncProcess] Error authenticating with Google Drive:", error);
        throw new Error("Failed to authenticate with Google Drive.");
    }
}

// --- File System Operations ---
async function clearDirectory(directory: string): Promise<void> {
    try {
        const files = await fs.readdir(directory);
        for (const file of files) {
            await fs.unlink(path.join(directory, file));
        }
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            console.error(`[SyncProcess] Error clearing directory ${directory}:`, error);
        }
    }
}

async function writeSyncLog(message: string): Promise<void> {
    try {
        const timestamp = new Date().toISOString();
        await fs.appendFile(SYNC_LOG_PATH, `${timestamp} - ${message}\n`);
    } catch (error) {
        console.error("[SyncProcess] Error writing to sync.log:", error);
    }
}

// --- Core Sync Logic ---

async function downloadAndSaveFile(drive: drive_v3.Drive, fileId: string, localPath: string): Promise<void> {
    const dest = fs.writeFile(localPath, ''); // Create empty file to write to
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    
    return new Promise((resolve, reject) => {
        const fileStream = require('fs').createWriteStream(localPath);
        res.data
            .on('end', () => {
                // console.log(`[SyncProcess] Downloaded ${path.basename(localPath)}`);
                resolve();
            })
            .on('error', (err: any) => {
                console.error(`[SyncProcess] Error downloading ${path.basename(localPath)}:`, err);
                reject(err);
            })
            .pipe(fileStream);
    });
}


async function syncFolder(drive: drive_v3.Drive, folderId: string, localFolderPath: string): Promise<void> {
    await fs.mkdir(localFolderPath, { recursive: true });
    
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
    });

    if (!res.data.files) return;

    for (const file of res.data.files) {
        if (!file.id || !file.name) continue;
        
        const localPath = path.join(localFolderPath, file.name);
        
        if (file.mimeType === 'application/vnd.google-apps.folder') {
            await syncFolder(drive, file.id, localPath);
        } else {
            await downloadAndSaveFile(drive, file.id, localPath);
        }
    }
}


async function runSync() {
    console.log('[SyncProcess] Starting sync from Google Drive...');
    await writeSyncLog("Sync initialized");
    try {
        const drive = await getDriveClient();
        const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!rootFolderId) {
            throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set in environment variables.");
        }

        // Find root files
        const rootFilesRes = await drive.files.list({
            q: `'${rootFolderId}' in parents and (name='config.json' or name='live.json') and trashed=false`,
            fields: 'files(id, name)',
        });

        const rootFiles = rootFilesRes.data.files || [];
        for (const file of rootFiles) {
            if (file.id && file.name) {
                await downloadAndSaveFile(drive, file.id, path.join(DATA_DIR, file.name));
            }
        }
        
        // Find and sync 'tournaments' folder
        const tournamentsFolderRes = await drive.files.list({
            q: `'${rootFolderId}' in parents and name='tournaments' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
        });

        const tournamentsFolder = tournamentsFolderRes.data.files?.[0];
        if (tournamentsFolder?.id) {
            const localTournamentsDir = path.join(DATA_DIR, 'tournaments');
            await fs.rm(localTournamentsDir, { recursive: true, force: true });
            await syncFolder(drive, tournamentsFolder.id, localTournamentsDir);
        }

        await writeSyncLog("Sync completed successfully.");
        console.log('[SyncProcess] Sync from Google Drive completed successfully.');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await writeSyncLog(`Sync FAILED: ${errorMessage}`);
        console.error('[SyncProcess] Sync process failed:', error);
    }
}


// --- Exported Function to Start the Process ---

let syncIntervalId: NodeJS.Timeout | null = null;

export function startBackgroundSync(): void {
    if (syncIntervalId) {
        console.log("[SyncProcess] Background sync is already running.");
        return;
    }
    
    const intervalMinutes = parseInt(process.env.GOOGLE_DRIVE_SYNC_INTERVAL_MINUTES || '10', 10);
    if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
        console.error("[SyncProcess] Invalid GOOGLE_DRIVE_SYNC_INTERVAL_MINUTES. Must be a positive number.");
        return;
    }
    
    const intervalMs = intervalMinutes * 60 * 1000;

    // Run once immediately on startup
    runSync();

    // Then set the interval for subsequent runs
    syncIntervalId = setInterval(runSync, intervalMs);

    console.log(`[SyncProcess] Background sync scheduled to run every ${intervalMinutes} minutes.`);
}
