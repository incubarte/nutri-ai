
// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.

import * as localProvider from './local-provider';
import * as gdriveOverrideProvider from './gdrive-override-provider';

const provider = process.env.STORAGE_PROVIDER || 'local';

let selectedProvider;

switch (provider) {
    case 'googledrive_override':
        if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
            console.log("Using 'googledrive_override' storage provider.");
            console.log("-> Reads will be from local disk.");
            console.log("-> Writes are disabled.");
            console.log("-> Background sync from Google Drive is active (managed by server-side-store).");
            selectedProvider = gdriveOverrideProvider;
            // La sincronización ahora es iniciada por server-side-store.ts
        } else {
             console.log("Using 'googledrive_override' but not in read-only mode. Falling back to local provider.");
             selectedProvider = localProvider;
        }
        break;
        
    case 'googledrive':
        console.warn("The 'googledrive' provider is not fully implemented. Falling back to 'local'.");
        selectedProvider = localProvider;
        break;
        
    case 'local':
    default:
        console.log("Using 'local' storage provider.");
        selectedProvider = localProvider;
        break;
}


// Re-exportamos las funciones del proveedor seleccionado.
export const {
    readConfig,
    writeConfig,
    readLiveState,
    writeLiveState,
    readTournament,
    writeTournament,
} = selectedProvider;
