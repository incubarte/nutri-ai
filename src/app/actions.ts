

'use client';

import type { LiveGameState, ConfigState } from '@/types';

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
