
import type { LiveGameState, ConfigState, RemoteCommand } from '@/types';
import { EventEmitter } from 'events';
import { headers } from 'next/headers';
import os from 'os';

let storedConfig: ConfigState | null = null;
let storedGameState: LiveGameState | null = null;

// Use globalThis to ensure a single instance across HMR reloads in development
const globalForState = globalThis as unknown as {
  gameStateEmitter: EventEmitter | undefined;
  commandEmitter: EventEmitter | undefined;
  remoteAccessPassword: string | null | undefined;
};


export const gameStateEmitter =
  globalForState.gameStateEmitter ?? new EventEmitter();
  
export const commandEmitter =
  globalForState.commandEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForState.gameStateEmitter = gameStateEmitter;
  globalForState.commandEmitter = commandEmitter;
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

export function sendCommand(command: RemoteCommand): void {
  commandEmitter.emit('command', command);
}

function generatePassword() {
    const newPassword = Math.floor(10000 + Math.random() * 90000).toString();
    globalForState.remoteAccessPassword = newPassword;
    console.log(`*************************************************`);
    console.log(`* Remote Access Password: ${newPassword} *`);
    console.log(`*************************************************`);
}

export function getRemoteAccessPassword(): string {
    if (!globalForState.remoteAccessPassword) {
        generatePassword();
    }
    return globalForState.remoteAccessPassword!;
}

export function isClientLocal(request: Request): boolean {
    const reqHeaders = headers();
    const clientIp = (reqHeaders.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    
    // Check if client is localhost. This is the most reliable check.
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        return true;
    }

    // A more advanced subnet check is prone to errors in different network environments.
    // For simplicity and robustness in this application's context, we'll consider any
    // non-loopback IP as "remote", requiring a password. This is a safer default.
    return false;
}

// Ensure password is generated on startup
getRemoteAccessPassword();
