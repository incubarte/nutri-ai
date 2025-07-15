

'use client';

import type { LiveGameState, ConfigState, RemoteCommand } from '@/types';

export async function updateConfigOnServer(config: ConfigState) {
  // The try/catch is removed. Let the caller handle errors.
  await fetch('/api/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });
}

export async function updateGameStateOnServer(gameState: LiveGameState) {
    // The try/catch is removed. Let the caller handle errors.
    await fetch('/api/game-state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gameState),
    });
}

export async function sendRemoteCommand(command: RemoteCommand) {
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
      throw new Error(errorData.message || 'Failed to send remote command.');
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
