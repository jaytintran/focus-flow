import { Category, JournalEntry, Task } from "./types";

// 100% Offline IndexedDB wrapper - NO network requests
const DB_NAME = "focusflow_db";
const DB_VERSION = 3;

const LEGACY_STORE = "keyvalue";
const TASKS_STORE = "tasks";
const ARCHIVED_TASKS_STORE = "archivedTasks";
const JOURNAL_STORE = "journal";
const CATEGORIES_STORE = "categories";
const SETTINGS_STORE = "settings";

const MIGRATION_DONE_KEY = "structured_storage_migrated_v2";
const TASK_ORDER_KEY = "focusflow_task_order";
const CATEGORY_ORDER_KEY = "focusflow_category_order";

const LEGACY_KEYS = [
	"focusflow_tasks",
	"focusflow_categories",
	"focusflow_journal",
	"focusflow_darkmode",
	"focusflow_viewmode",
	"focusflow_layouttype",
	"focusflow_showalltasks",
	"focusflow_showcompleted",
	"focusflow_activetaskid",
	"focusflow_timeractive",
	"focusflow_timerlasttick",
	"focusflow_timerstarttime",
	"focusflow_initialspenttime",
	"journalViewMode",
];

interface DBInstance {
	db: IDBDatabase | null;
	initPromise: Promise<IDBDatabase> | null;
}

const dbInstance: DBInstance = {
	db: null,
	initPromise: null,
};

function createStoreIfMissing(db: IDBDatabase, storeName: string): void {
	if (!db.objectStoreNames.contains(storeName)) {
		db.createObjectStore(storeName);
	}
}

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
			createStoreIfMissing(db, LEGACY_STORE);
			createStoreIfMissing(db, TASKS_STORE);
			createStoreIfMissing(db, ARCHIVED_TASKS_STORE);
			createStoreIfMissing(db, JOURNAL_STORE);
			createStoreIfMissing(db, CATEGORIES_STORE);
			createStoreIfMissing(db, SETTINGS_STORE);
		};
	});

	return dbInstance.initPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () => reject(transaction.error);
		transaction.onabort = () => reject(transaction.error);
	});
}

async function getFromStore<T>(
	storeName: string,
	key: IDBValidKey,
): Promise<T | null> {
	try {
		const db = await initDB();
		const transaction = db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		const result = await requestToPromise<T | undefined>(store.get(key));
		return result ?? null;
	} catch (error) {
		console.error(`IndexedDB get error (${storeName}:${String(key)}):`, error);
		return null;
	}
}

async function putInStore<T>(
	storeName: string,
	key: IDBValidKey,
	value: T,
): Promise<void> {
	try {
		const db = await initDB();
		const transaction = db.transaction(storeName, "readwrite");
		const store = transaction.objectStore(storeName);
		await requestToPromise(store.put(value, key));
		await transactionDone(transaction);
	} catch (error) {
		console.error(`IndexedDB put error (${storeName}:${String(key)}):`, error);
	}
}

async function deleteFromStore(
	storeName: string,
	key: IDBValidKey,
): Promise<void> {
	try {
		const db = await initDB();
		const transaction = db.transaction(storeName, "readwrite");
		const store = transaction.objectStore(storeName);
		await requestToPromise(store.delete(key));
		await transactionDone(transaction);
	} catch (error) {
		console.error(
			`IndexedDB delete error (${storeName}:${String(key)}):`,
			error,
		);
	}
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
	try {
		const db = await initDB();
		const transaction = db.transaction(storeName, "readonly");
		const store = transaction.objectStore(storeName);
		return await requestToPromise<T[]>(store.getAll());
	} catch (error) {
		console.error(`IndexedDB getAll error (${storeName}):`, error);
		return [];
	}
}

async function syncRecords<T extends { id: string }>(
	storeName: string,
	records: T[],
): Promise<void> {
	if (records.length === 0) return; // Safety: never wipe data with empty array
	try {
		const db = await initDB();
		const transaction = db.transaction(storeName, "readwrite");
		const store = transaction.objectStore(storeName);
		const [existingKeys, existingRecords] = await Promise.all([
			requestToPromise<IDBValidKey[]>(store.getAllKeys()),
			requestToPromise<T[]>(store.getAll()),
		]);

		const nextById = new Map(records.map((record) => [record.id, record]));
		const existingById = new Map(
			existingRecords.map((record) => [record.id, JSON.stringify(record)]),
		);

		for (const key of existingKeys) {
			if (typeof key === "string" && !nextById.has(key)) {
				store.delete(key);
			}
		}

		for (const record of records) {
			if (existingById.get(record.id) !== JSON.stringify(record)) {
				store.put(record, record.id);
			}
		}

		await transactionDone(transaction);
	} catch (error) {
		console.error(`IndexedDB sync error (${storeName}):`, error);
	}
}

function sortNewestFirst<T extends { createdAt?: number; timestamp?: number }>(
	records: T[],
): T[] {
	return [...records].sort(
		(a, b) => (b.createdAt ?? b.timestamp ?? 0) - (a.createdAt ?? a.timestamp ?? 0),
	);
}

function sortByStoredOrder<T extends { id: string }>(
	records: T[],
	order: string[] | null,
	fallback: (records: T[]) => T[],
): T[] {
	if (!order) return fallback(records);

	const orderById = new Map(order.map((id, index) => [id, index]));
	return [...records].sort((a, b) => {
		const aIndex = orderById.get(a.id);
		const bIndex = orderById.get(b.id);
		if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
		if (aIndex !== undefined) return -1;
		if (bIndex !== undefined) return 1;
		return 0;
	});
}

async function getStoredOrder(key: string): Promise<string[] | null> {
	const raw = await getSetting(key);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : null;
	} catch (error) {
		console.error(`Failed to parse stored order (${key}):`, error);
		return null;
	}
}

async function setStoredOrder<T extends { id: string }>(
	key: string,
	records: T[],
): Promise<void> {
	await setSetting(key, JSON.stringify(records.map((record) => record.id)));
}

export async function getTasks(): Promise<Task[]> {
	const [tasks, order] = await Promise.all([
		getAllFromStore<Task>(TASKS_STORE),
		getStoredOrder(TASK_ORDER_KEY),
	]);
	return sortByStoredOrder(tasks, order, sortNewestFirst);
}

export async function syncTasks(tasks: Task[]): Promise<void> {
	if (tasks.length === 0) return; // Safety: never wipe data with empty array
	await Promise.all([syncRecords(TASKS_STORE, tasks), setStoredOrder(TASK_ORDER_KEY, tasks)]);
}

export async function putTask(task: Task): Promise<void> {
	await putInStore(TASKS_STORE, task.id, task);
}

export async function deleteTask(id: string): Promise<void> {
	await deleteFromStore(TASKS_STORE, id);
}

export async function getArchivedTasks(): Promise<Task[]> {
	return sortNewestFirst(await getAllFromStore<Task>(ARCHIVED_TASKS_STORE));
}

export async function syncArchivedTasks(tasks: Task[]): Promise<void> {
	await syncRecords(ARCHIVED_TASKS_STORE, tasks);
}

export async function putArchivedTask(task: Task): Promise<void> {
	await putInStore(ARCHIVED_TASKS_STORE, task.id, task);
}

export async function deleteArchivedTask(id: string): Promise<void> {
	await deleteFromStore(ARCHIVED_TASKS_STORE, id);
}

export async function getJournalEntries(): Promise<JournalEntry[]> {
	return sortNewestFirst(await getAllFromStore<JournalEntry>(JOURNAL_STORE));
}

export async function syncJournalEntries(
	entries: JournalEntry[],
): Promise<void> {
	await syncRecords(JOURNAL_STORE, entries);
}

export async function getCategories(): Promise<Category[]> {
	const [categories, order] = await Promise.all([
		getAllFromStore<Category>(CATEGORIES_STORE),
		getStoredOrder(CATEGORY_ORDER_KEY),
	]);
	return sortByStoredOrder(categories, order, (records) => records);
}

export async function syncCategories(categories: Category[]): Promise<void> {
	await Promise.all([
		syncRecords(CATEGORIES_STORE, categories),
		setStoredOrder(CATEGORY_ORDER_KEY, categories),
	]);
}

export async function getSetting(key: string): Promise<string | null> {
	return getFromStore<string>(SETTINGS_STORE, key);
}

export async function setSetting(key: string, value: string): Promise<void> {
	await putInStore(SETTINGS_STORE, key, value);
}

export async function removeSetting(key: string): Promise<void> {
	await deleteFromStore(SETTINGS_STORE, key);
}

// Backward-compatible key/value helpers for tiny settings.
export const getItem = getSetting;
export const setItem = setSetting;
export const removeItem = removeSetting;

export async function clear(): Promise<void> {
	try {
		const db = await initDB();
		const transaction = db.transaction(
			[
				TASKS_STORE,
				ARCHIVED_TASKS_STORE,
				JOURNAL_STORE,
				CATEGORIES_STORE,
				SETTINGS_STORE,
			],
			"readwrite",
		);
		for (const storeName of [
			TASKS_STORE,
			ARCHIVED_TASKS_STORE,
			JOURNAL_STORE,
			CATEGORIES_STORE,
			SETTINGS_STORE,
		]) {
			transaction.objectStore(storeName).clear();
		}
		await transactionDone(transaction);
	} catch (error) {
		console.error("IndexedDB clear error:", error);
	}
}

async function getLegacyItem(key: string): Promise<string | null> {
	const indexedDbValue = await getFromStore<string>(LEGACY_STORE, key);
	if (indexedDbValue !== null) {
		return indexedDbValue;
	}
	return localStorage.getItem(key);
}

async function migrateJsonArray<T extends { id: string }>(
	key: string,
	storeName: string,
): Promise<void> {
	const raw = await getLegacyItem(key);
	if (!raw) return;

	try {
		const records = JSON.parse(raw) as T[];
		if (Array.isArray(records)) {
			await syncRecords(storeName, records);
		}
	} catch (error) {
		console.error(`Failed to migrate ${key}:`, error);
	}
}

async function migrateSetting(key: string): Promise<void> {
	const value = await getLegacyItem(key);
	if (value !== null) {
		await setSetting(key, value);
	}
}

async function cleanupLegacyStorage(): Promise<void> {
	for (const key of LEGACY_KEYS) {
		localStorage.removeItem(key);
		await deleteFromStore(LEGACY_STORE, key);
	}
}

// Migration helper: copy old localStorage/keyvalue blobs into structured stores.
export async function migrateFromLocalStorage(): Promise<void> {
	const alreadyMigrated = await getSetting(MIGRATION_DONE_KEY);
	if (alreadyMigrated === "true") {
		await cleanupLegacyStorage();
		return;
	}

	await migrateJsonArray<Task>("focusflow_tasks", TASKS_STORE);
	await migrateJsonArray<Category>("focusflow_categories", CATEGORIES_STORE);
	await migrateJsonArray<JournalEntry>("focusflow_journal", JOURNAL_STORE);

	const [legacyTasks, legacyCategories] = await Promise.all([
		getLegacyItem("focusflow_tasks"),
		getLegacyItem("focusflow_categories"),
	]);
	if (legacyTasks) {
		try {
			const tasks = JSON.parse(legacyTasks) as Task[];
			if (Array.isArray(tasks)) await setStoredOrder(TASK_ORDER_KEY, tasks);
		} catch (error) {
			console.error("Failed to migrate task order:", error);
		}
	}
	if (legacyCategories) {
		try {
			const categories = JSON.parse(legacyCategories) as Category[];
			if (Array.isArray(categories)) {
				await setStoredOrder(CATEGORY_ORDER_KEY, categories);
			}
		} catch (error) {
			console.error("Failed to migrate category order:", error);
		}
	}

	await Promise.all(
		LEGACY_KEYS.filter(
			(key) =>
				key !== "focusflow_tasks" &&
				key !== "focusflow_categories" &&
				key !== "focusflow_journal",
		).map(migrateSetting),
	);

	await setSetting(MIGRATION_DONE_KEY, "true");
	await cleanupLegacyStorage();
}
