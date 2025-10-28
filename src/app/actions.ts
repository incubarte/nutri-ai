

'use client';

import type { GameState } from '@/types';

export async function saveDataOnServer(data: Partial<GameState>) {
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
