

'use client';

import type { LiveGameState, ConfigState, RemoteCommand } from '@/types';

export async function updateConfigOnServer(config: ConfigState) {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
  } catch (error) {
    console.error('Failed to send config to server:', error);
  }
}

export async function updateGameStateOnServer(gameState: LiveGameState) {
    try {
        await fetch('/api/game-state', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gameState),
        });
      } catch (error) {
        console.error('Failed to send game state to server:', error);
      }
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

