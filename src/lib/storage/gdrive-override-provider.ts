
import * as localProvider from './local-provider';

// --- READ OPERATIONS ---
// All read operations are delegated to the local provider for speed.
export const readConfig = localProvider.readConfig;
export const readLiveState = localProvider.readLiveState;
export const readTournament = localProvider.readTournament;


// --- WRITE OPERATIONS ---
// Write operations are disabled in this mode. They do nothing.

const noOpWrite = async (entity?: any) => {
    if (process.env.NODE_ENV === 'development') {
        // console.log(`[GoogleDriveOverride] Write operation for ${entity ? entity.constructor.name : 'unknown entity'} was ignored.`);
    }
    return Promise.resolve();
};

export const writeConfig = async (config: any) => noOpWrite(config);
export const writeLiveState = async (liveState: any) => noOpWrite(liveState);
export const writeTournament = async (tournament: any) => noOpWrite(tournament);
