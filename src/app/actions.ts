
'use client';

import type { GameState, ConfigState, LiveState } from '@/types';

export async function saveDataOnServer(data: { config: ConfigState; live: LiveState }) {
  try {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save data.');
    }
    return await response.json();
  } catch (error) {
     console.error('Failed to save data on server:', error);
     if (error instanceof Error) {
        return { success: false, message: error.message };
    }
    return { success: false, message: 'An unknown error occurred while saving data.' };
  }
}

// These functions below are now wrappers around saveDataOnServer.
// They can be removed if you update all call sites to use saveDataOnServer directly.
export async function updateConfigOnServer(config: ConfigState) {
    // This is a bit of a hack. The server expects both config and live state.
    // We don't have live state here, so we send an empty object.
    // The server-side logic should be robust enough to handle this.
    return saveDataOnServer({ config, live: {} as LiveState });
}

export async function updateGameStateOnServer(live: LiveState) {
    // This function is now a no-op as live state is not persisted on the server.
    // The config state which is persisted is handled by updateConfigOnServer.
    return Promise.resolve({ success: true, message: 'Live state is not persisted.' });
}

// Keep sendRemoteCommand as it's used by client components
export async function sendRemoteCommand(command: any) {
  try {
    const response = await fetch('/api/remote-commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send command.');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to send remote command:', error);
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: 'An unknown error occurred.' };
  }
}
