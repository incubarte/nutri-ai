
import type { LiveGameState, ConfigState, RemoteCommand, AccessRequest } from '@/types';
import { EventEmitter } from 'events';
import { headers } from 'next/headers';
import fs from 'fs';
import path from 'path';
import os from 'os';

let storedConfig: ConfigState | null = null;
let storedGameState: LiveGameState | null = null;
let accessRequests: Map<string, AccessRequest> = new Map();

const PASSWORD_FILE_PATH = path.join(os.tmpdir(), '.remote_password');

// --- Centralized Password Management ---
function generatePassword(): string {
    const newPassword = Math.floor(10000 + Math.random() * 90000).toString();
    try {
        fs.writeFileSync(PASSWORD_FILE_PATH, newPassword, 'utf8');
        console.log(`*************************************************`);
        console.log(`* New Remote Access Password Generated: ${newPassword} *`);
        console.log(`* Stored at: ${PASSWORD_FILE_PATH}                 *`);
        console.log(`*************************************************`);
        return newPassword;
    } catch (error) {
        console.error("!!! CRITICAL: FAILED TO WRITE PASSWORD FILE !!!", error);
        // Fallback to in-memory if file system fails
        return newPassword;
    }
}

function readPassword(): string | null {
    try {
        if (fs.existsSync(PASSWORD_FILE_PATH)) {
            return fs.readFileSync(PASSWORD_FILE_PATH, 'utf8').trim();
        }
        return null;
    } catch (error) {
        console.error("!!! CRITICAL: FAILED TO READ PASSWORD FILE !!!", error);
        return null;
    }
}

export function getRemoteAccessPassword(): string {
    let password = readPassword();
    if (!password) {
        password = generatePassword();
    }
    return password;
}
// --- End Password Management ---


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

// --- Auth Challenge Management ---

export function createAccessRequest(ip: string, userAgent: string | undefined, verificationNumber: number): AccessRequest {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const request: AccessRequest = { id, ip, timestamp: Date.now(), userAgent, verificationNumber, approved: false };
    accessRequests.set(id, request);
    // Set a timeout to remove the request after 2 minutes if it's not approved.
    setTimeout(() => {
        const req = accessRequests.get(id);
        if (req && !req.approved) {
             removeAccessRequest(id);
        }
    }, 2 * 60 * 1000);
    return request;
}

export function getAccessRequest(id: string): AccessRequest | undefined {
    return accessRequests.get(id);
}

export function getAllAccessRequests(): AccessRequest[] {
    return Array.from(accessRequests.values()).filter(req => !req.approved);
}

export function removeAccessRequest(id: string): void {
    accessRequests.delete(id);
}

export function approveAccessRequest(id: string): boolean {
    const request = accessRequests.get(id);
    if (!request) {
        return false;
    }
    request.approved = true;
    accessRequests.set(id, request);
    
    // Remove the request after a short period to allow the client to fetch the password
    setTimeout(() => removeAccessRequest(id), 30 * 1000);
    
    return true;
}


// Ensure password file is checked/created on startup
getRemoteAccessPassword();
