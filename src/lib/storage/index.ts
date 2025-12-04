// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.

import { StorageProvider, LocalFileStorageProvider, SupabaseStorageProvider } from './providers';

const createStorageProvider = (): StorageProvider => {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    console.log('========================================');
    console.log(`[STORAGE] Initializing storage provider`);
    console.log(`[STORAGE] STORAGE_PROVIDER env var: '${providerType}'`);
    console.log('========================================');

    switch (providerType) {
        case 'supabase_rw':
            console.log('[STORAGE] ✅ Using Supabase Storage (Read-Write mode)');
            return new SupabaseStorageProvider('rw');
        case 'supabase_ro':
            console.log('[STORAGE] ✅ Using Supabase Storage (Read-Only mode)');
            return new SupabaseStorageProvider('ro');
        case 'local':
        default:
            console.log('[STORAGE] ✅ Using Local File Storage');
            return new LocalFileStorageProvider();
    }
};

export const storageProvider = createStorageProvider();

// Helper to check if we're in read-only mode (supabase_ro)
export function isReadOnlyMode(): boolean {
    const providerType = process.env.STORAGE_PROVIDER || 'local';
    return providerType === 'supabase_ro';
}
