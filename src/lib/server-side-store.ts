
import type { LiveGameState, ConfigState } from '@/types';
import { EventEmitter } from 'events';

let storedConfig: ConfigState | null = null;
let storedGameState: LiveGameState | null = null;

const globalForEmitter = globalThis as unknown as {
  gameStateEmitter: EventEmitter | undefined;
};

export const gameStateEmitter =
  globalForEmitter.gameStateEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitter.gameStateEmitter = gameStateEmitter;
}


export function getConfig(): ConfigState | null {
  return storedConfig;
}

export function setConfig(newConfig: ConfigState): void {
  storedConfig = newConfig;
}

export function getGameState(): LiveGameState | null {
  return storedGameState;
}

export function setGameState(newGameState: LiveGameState): void {
  storedGameState = newGameState;
  gameStateEmitter.emit('update', newGameState);
}
