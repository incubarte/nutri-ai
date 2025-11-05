
// Este archivo actúa como un punto de entrada para el sistema de almacenamiento.
// Lee la variable de entorno para decidir qué proveedor de almacenamiento usar.
// Por ahora, solo soporta el almacenamiento local.

import * as localProvider from './local-provider';

const provider = process.env.STORAGE_PROVIDER;

if (provider === 'local') {
    console.log("Using 'local' storage provider.");
} else {
    // En el futuro, aquí se podría manejar un proveedor de 'googledrive' o dar un error.
    console.warn(`Storage provider '${provider}' is not supported. Falling back to 'local'.`);
}

// Re-exportamos las funciones del proveedor local.
// Cuando añadamos Google Drive, aquí habrá una lógica condicional.
export const {
    readConfig,
    writeConfig,
    readLiveState,
    writeLiveState,
    readTournament,
    writeTournament,
} = localProvider;
