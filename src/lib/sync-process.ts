
import { google } from 'googleapis';
import { promises as fs } from 'fs';
import path from 'path';
import type { drive_v3 } from 'googleapis';
import * as localProvider from './storage/local-provider';

const KEYFILE_PATH = path.join(process.cwd(), 'env_drive_credentials.json');
const SYNC_LOG_PATH = path.join(process.cwd(), 'sync.log');
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
async function writeSyncLog(message: string): Promise<void> {
    try {
        await fs.mkdir(path.dirname(SYNC_LOG_PATH), { recursive: true });
        const timestamp = new Date().toISOString();
        await fs.appendFile(SYNC_LOG_PATH, `${timestamp} - ${message}\n`);
    } catch (error) {
        console.error("[SyncProcess] Error writing to sync.log:", error);
    }
}

// --- Core Sync Logic ---

async function downloadAndSaveFile(drive: drive_v3.Drive, fileId: string, localPath: string): Promise<void> {
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    const dest = require('fs').createWriteStream(localPath);
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    
    return new Promise((resolve, reject) => {
        res.data
            .on('end', () => resolve())
            .on('error', (err: any) => {
                console.error(`[SyncProcess] Error downloading ${path.basename(localPath)}:`, err);
                reject(err);
            })
            .pipe(dest);
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

let isSyncing = false; // Semaphore to prevent concurrent syncs

async function runSync() {
    await writeSyncLog("Sync initialized");
    console.log('[SyncProcess] Starting sync from Google Drive...');
    
    const tempDir = path.join(process.cwd(), `_temp_sync_${Date.now()}`);

    try {
        await fs.mkdir(tempDir, { recursive: true });

        const drive = await getDriveClient();
        const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
        if (!rootFolderId) {
            throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set in environment variables.");
        }

        // 1. Version Check
        const versionFileRes = await drive.files.list({
            q: `'${rootFolderId}' in parents and name='lastSyncVersion.log' and trashed=false`,
            fields: 'files(id, name)',
        });
        
        let remoteVersion = 0;
        const versionFile = versionFileRes.data.files?.[0];
        if (versionFile?.id) {
            const res = await drive.files.get({ fileId: versionFile.id, alt: 'media' });
            const versionContent = await streamToString(res.data);
            remoteVersion = parseInt(versionContent.trim(), 10) || 0;
        } else {
            await writeSyncLog("Remote version file not found, forcing sync.");
            console.log("[SyncProcess] Remote version file 'lastSyncVersion.log' not found in Drive. Forcing sync.");
            remoteVersion = Number.MAX_SAFE_INTEGER; // Force sync if remote version file doesn't exist
        }

        const localVersion = await localProvider.readVersion();

        if (remoteVersion <= localVersion) {
            const message = `Sync skipped: Remote version (${remoteVersion}) is not newer than local version (${localVersion}).`;
            console.log(`[SyncProcess] ${message}`);
            await writeSyncLog(message);
            await fs.rm(tempDir, { recursive: true, force: true }).catch(()=>{});
            return;
        }

        console.log(`[SyncProcess] Proceeding with sync: Remote version (${remoteVersion}) > Local version (${localVersion}).`);
        await writeSyncLog(`Proceeding with sync: Remote version (${remoteVersion}) > Local version (${localVersion}).`);

        // 2. Sync Files to Temporary Directory (in project root)
        const TEMP_DATA_DIR = path.join(tempDir, 'src/data'); // Replicate the final structure
        await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
        
        const rootFilesRes = await drive.files.list({
            q: `'${rootFolderId}' in parents and (name='config.json' or name='live.json') and trashed=false`,
            fields: 'files(id, name)',
        });

        for (const file of (rootFilesRes.data.files || [])) {
            if (file.id && file.name) {
                await downloadAndSaveFile(drive, file.id, path.join(TEMP_DATA_DIR, file.name));
            }
        }
        
        const tournamentsFolderRes = await drive.files.list({
            q: `'${rootFolderId}' in parents and name='tournaments' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: 'files(id)',
        });

        const tournamentsFolder = tournamentsFolderRes.data.files?.[0];
        if (tournamentsFolder?.id) {
            await syncFolder(drive, tournamentsFolder.id, path.join(TEMP_DATA_DIR, 'tournaments'));
        }

        // 3. Atomic Replace
        console.log('[SyncProcess] Download complete. Replacing local data...');
        const FINAL_DATA_DIR = path.join(process.cwd(), 'src/data');
        
        try {
            await fs.rm(FINAL_DATA_DIR, { recursive: true, force: true });
        } catch(e) {
            console.warn("[SyncProcess] Could not remove old data directory, it might not exist. Continuing...");
        }
        
        await fs.rename(TEMP_DATA_DIR, FINAL_DATA_DIR);

        // 4. Update local version file
        if (versionFile?.id) {
             const finalVersionPath = path.join(process.cwd(), 'lastSyncVersion.log');
             await downloadAndSaveFile(drive, versionFile.id, finalVersionPath);
        }

        await writeSyncLog("Sync completed successfully.");
        console.log('[SyncProcess] Sync from Google Drive completed successfully.');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await writeSyncLog(`Sync FAILED: ${errorMessage}`);
        console.error('[SyncProcess] Sync process failed:', error);
    } finally {
        // Clean up the temporary directory regardless of success or failure
        await fs.rm(tempDir, { recursive: true, force: true }).catch(err => console.error(`[SyncProcess] Failed to clean up temp directory: ${err}`));
    }
}

// Helper to read a stream to a string
function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: any) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err: any) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}


// --- Exported Functions ---

let syncIntervalId: NodeJS.Timeout | null = null;

export function startBackgroundSync(): void {
    if (syncIntervalId) {
        console.log("[SyncProcess] Background sync is already running.");
        return;
    }
    
    if (isSyncing) {
        console.log("[SyncProcess] A sync process is already in progress. Skipping new start request.");
        return;
    }
    
    const intervalMinutes = parseInt(process.env.GOOGLE_DRIVE_SYNC_INTERVAL_MINUTES || '10', 10);
    if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
        console.error("[SyncProcess] Invalid GOOGLE_DRIVE_SYNC_INTERVAL_MINUTES. Must be a positive number.");
        return;
    }
    
    const intervalMs = intervalMinutes * 60 * 1000;

    const syncAndRelease = async () => {
        if (isSyncing) return;
        isSyncing = true;
        try {
            await runSync();
        } finally {
            isSyncing = false;
        }
    };

    // Run once immediately on startup
    syncAndRelease();

    // Then set the interval for subsequent runs
    syncIntervalId = setInterval(syncAndRelease, intervalMs);

    console.log(`[SyncProcess] Background sync scheduled to run every ${intervalMinutes} minutes.`);
}

export async function triggerManualSync(): Promise<{ message: string, status: 'started' | 'busy' }> {
    if (isSyncing) {
        const message = "Sync is already in progress.";
        console.log(`[SyncProcess] Manual trigger failed: ${message}`);
        return { message, status: 'busy' };
    }

    // Run sync in the background, don't await it here
    (async () => {
        isSyncing = true;
        try {
            await runSync();
        } finally {
            isSyncing = false;
        }
    })();
    
    const message = "Manual sync process has been initiated.";
    console.log(`[SyncProcess] ${message}`);
    return { message, status: 'started' };
}
