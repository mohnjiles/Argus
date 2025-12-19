/**
 * Recent Folders Storage
 * Manages persistence of FileSystemDirectoryHandles using IndexedDB
 * (Necessary because localStorage cannot store Handle objects)
 */

const DB_NAME = 'ArgusHistory';
const STORE_NAME = 'RecentFolders';
const MAX_RECENT = 5;

export interface RecentFolder {
    path: string;
    handle: FileSystemDirectoryHandle;
    lastOpened: number;
}

/**
 * Open the IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'path' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Save a directory handle to recents
 */
export async function saveRecentFolder(handle: FileSystemDirectoryHandle): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        // Add or update the entry
        const putRequest = store.put({
            path: handle.name,
            handle: handle,
            lastOpened: Date.now(),
        });

        putRequest.onsuccess = async () => {
            // Cleanup: keep only the most recent N folders
            const allFolders = await getRecentFolders();
            if (allFolders.length > MAX_RECENT) {
                const toDelete = allFolders.slice(MAX_RECENT);
                const secondTx = db.transaction(STORE_NAME, 'readwrite');
                const secondStore = secondTx.objectStore(STORE_NAME);
                toDelete.forEach(f => secondStore.delete(f.path));
            }
            resolve();
        };
        putRequest.onerror = () => reject(putRequest.error);
    });
}

/**
 * Get the list of all recent folders, sorted by last opened time
 */
export async function getRecentFolders(): Promise<RecentFolder[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const folders = request.result as RecentFolder[];
            // Sort most recent first
            folders.sort((a, b) => b.lastOpened - a.lastOpened);
            resolve(folders);
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Remove a folder from recents
 */
export async function removeRecentFolder(path: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
        const request = store.delete(path);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Check if we still have permission for a handle (handles lose permission on page reload)
 * Returns 'granted', 'denied', or 'prompt'
 */
export async function verifyPermission(handle: FileSystemHandle): Promise<boolean> {
    const options = { mode: 'read' as const };

    // Check if permission is already granted
    if ((await (handle as any).queryPermission(options)) === 'granted') {
        return true;
    }

    // Request permission
    if ((await (handle as any).requestPermission(options)) === 'granted') {
        return true;
    }

    return false;
}
