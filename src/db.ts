// 100% Offline IndexedDB wrapper - NO network requests
const DB_NAME = "focusflow_db";
const DB_VERSION = 1;
const STORE_NAME = "keyvalue";

interface DBInstance {
	db: IDBDatabase | null;
	initPromise: Promise<IDBDatabase> | null;
}

const dbInstance: DBInstance = {
	db: null,
	initPromise: null,
};

function initDB(): Promise<IDBDatabase> {
	if (dbInstance.initPromise) {
		return dbInstance.initPromise;
	}

	dbInstance.initPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error("Failed to open IndexedDB"));
		};

		request.onsuccess = () => {
			dbInstance.db = request.result;
			resolve(request.result);
		};

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
	});

	return dbInstance.initPromise;
}

export async function getItem(key: string): Promise<string | null> {
	try {
		const db = await initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readonly");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(key);

			request.onsuccess = () => {
				resolve(request.result ?? null);
			};

			request.onerror = () => {
				reject(new Error(`Failed to get item: ${key}`));
			};
		});
	} catch (error) {
		console.error("IndexedDB getItem error:", error);
		return null;
	}
}

export async function setItem(key: string, value: string): Promise<void> {
	try {
		const db = await initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.put(value, key);

			request.onsuccess = () => {
				resolve();
			};

			request.onerror = () => {
				reject(new Error(`Failed to set item: ${key}`));
			};
		});
	} catch (error) {
		console.error("IndexedDB setItem error:", error);
	}
}

export async function removeItem(key: string): Promise<void> {
	try {
		const db = await initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(key);

			request.onsuccess = () => {
				resolve();
			};

			request.onerror = () => {
				reject(new Error(`Failed to remove item: ${key}`));
			};
		});
	} catch (error) {
		console.error("IndexedDB removeItem error:", error);
	}
}

export async function clear(): Promise<void> {
	try {
		const db = await initDB();
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(STORE_NAME, "readwrite");
			const store = transaction.objectStore(STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => {
				resolve();
			};

			request.onerror = () => {
				reject(new Error("Failed to clear store"));
			};
		});
	} catch (error) {
		console.error("IndexedDB clear error:", error);
	}
}

// Migration helper: copy data from localStorage to IndexedDB
export async function migrateFromLocalStorage(): Promise<void> {
	const keys = [
		"focusflow_tasks",
		"focusflow_categories",
		"focusflow_journal",
		"focusflow_darkmode",
		"focusflow_viewmode",
		"focusflow_layouttype",
		"focusflow_showalltasks",
	];

	for (const key of keys) {
		const value = localStorage.getItem(key);
		if (value !== null) {
			await setItem(key, value);
		}
	}
}
