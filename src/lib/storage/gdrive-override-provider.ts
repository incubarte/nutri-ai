
import * as localProvider from './local-provider';
import { startBackgroundSync } from '@/lib/sync-process';

const globalForSync = globalThis as unknown as {
  syncStarted: boolean | undefined;
};

// --- READ OPERATIONS ---
// All read operations are delegated to the local provider for speed.
export const readConfig = localProvider.readConfig;
export const readLiveState = localProvider.readLiveState;
export const readTournament = localProvider.readTournament;
// Re-export getStorageDir so it's available when this provider is active
export const getStorageDir = localProvider.getStorageDir;


// --- WRITE OPERATIONS ---
// Write operations are disabled in this mode. They do nothing.
const noOpWrite = async (entity?: any) => {
    // This function intentionally does nothing.
    return Promise.resolve();
};

export const writeConfig = async (config: any) => noOpWrite(config);
export const writeLiveState = async (liveState: any) => noOpWrite(liveState);
export const writeTournament = async (tournament: any) => noOpWrite(tournament);


// --- BACKGROUND SYNC INITIALIZATION ---
// This code runs once when the module is first imported by the server.
if (!globalForSync.syncStarted) {
    console.log("[GoogleDriveOverride] Initializing background sync process...");
    startBackgroundSync();
    globalForSync.syncStarted = true;
}
