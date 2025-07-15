
import type { LiveGameState, ConfigState, RemoteCommand } from '@/types';
import { EventEmitter } from 'events';
import { headers } from 'next/headers';
import os from 'os';

let storedConfig: ConfigState | null = null;
let storedGameState: LiveGameState | null = null;
let remoteAccessPassword: string | null = null;

const globalForEmitters = globalThis as unknown as {
  gameStateEmitter: EventEmitter | undefined;
  commandEmitter: EventEmitter | undefined;
};

export const gameStateEmitter =
  globalForEmitters.gameStateEmitter ?? new EventEmitter();
  
export const commandEmitter =
  globalForEmitters.commandEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') {
  globalForEmitters.gameStateEmitter = gameStateEmitter;
  globalForEmitters.commandEmitter = commandEmitter;
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
    remoteAccessPassword = Math.floor(10000 + Math.random() * 90000).toString();
    console.log(`*************************************************`);
    console.log(`* Remote Access Password: ${remoteAccessPassword} *`);
    console.log(`*************************************************`);
}

export function getRemoteAccessPassword(): string {
    if (!remoteAccessPassword) {
        generatePassword();
    }
    return remoteAccessPassword!;
}

export function isClientLocal(request: Request): boolean {
    const reqHeaders = headers();
    const clientIp = (reqHeaders.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    
    // Check if client is localhost
    if (clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
        return true;
    }

    // Check if client is on the same subnet as the server
    const networkInterfaces = os.networkInterfaces();
    for (const iface in networkInterfaces) {
        const addresses = networkInterfaces[iface];
        if (addresses) {
            for (const addr of addresses) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    // Very basic subnet check. Assumes a /24 subnet mask.
                    const serverSubnet = addr.address.substring(0, addr.address.lastIndexOf('.'));
                    const clientSubnet = clientIp.substring(0, clientIp.lastIndexOf('.'));
                    if (serverSubnet === clientSubnet) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

// Ensure password is generated on startup
getRemoteAccessPassword();
