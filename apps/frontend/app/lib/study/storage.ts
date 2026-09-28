/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：IndexedDB 存储封装
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
/**
 * IndexedDB 持久化层。
 *
 * 只用了浏览器原生 API，不引入额外依赖：数据量很小（几百条记录），
 * 手写一层 Promise 封装比拉一个 idb 库更轻。
 */

const DB_NAME = "ryot-study";
const DB_VERSION = 1;

export const STORES = {
	kaoyan: "kaoyan",
	// 公考 / 事业编任务。与考研分开存放，两套数据互不干扰
	gongkao: "gongkao",
	cet: "cet",
	review: "review",
	settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === "undefined") {
			reject(new Error("当前环境不支持 IndexedDB"));
			return;
		}
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			for (const name of Object.values(STORES)) {
				if (!db.objectStoreNames.contains(name))
					db.createObjectStore(name, { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return dbPromise;
}

function transaction<T>(
	store: StoreName,
	mode: IDBTransactionMode,
	run: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return openDatabase().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(store, mode);
				const request = run(tx.objectStore(store));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			}),
	);
}

export const getAll = <T>(store: StoreName) =>
	transaction<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);

export const getOne = <T>(store: StoreName, id: string) =>
	transaction<T | undefined>(
		store,
		"readonly",
		(s) => s.get(id) as IDBRequest<T | undefined>,
	);

export const put = <T>(store: StoreName, value: T) =>
	transaction(store, "readwrite", (s) => s.put(value as never) as IDBRequest<IDBValidKey>);

export const remove = (store: StoreName, id: string) =>
	transaction(store, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);

export const clearStore = (store: StoreName) =>
	transaction(store, "readwrite", (s) => s.clear() as IDBRequest<undefined>);

/** 导出全部数据，用于备份 / 迁移到其它设备 */
export async function exportAll() {
	const [kaoyan, gongkao, cet, review, settings] = await Promise.all([
		getAll(STORES.kaoyan),
		getAll(STORES.gongkao),
		getAll(STORES.cet),
		getAll(STORES.review),
		getAll(STORES.settings),
	]);
	return {
		version: 2,
		exportedAt: new Date().toISOString(),
		kaoyan,
		gongkao,
		cet,
		review,
		settings,
	};
}

/** 从备份恢复，会先清空现有数据 */
export async function importAll(payload: {
	kaoyan?: unknown[];
	gongkao?: unknown[];
	cet?: unknown[];
	review?: unknown[];
	settings?: unknown[];
}) {
	if (payload.kaoyan) {
		await clearStore(STORES.kaoyan);
		for (const item of payload.kaoyan) await put(STORES.kaoyan, item);
	}
	if (payload.gongkao) {
		await clearStore(STORES.gongkao);
		for (const item of payload.gongkao) await put(STORES.gongkao, item);
	}
	if (payload.cet) {
		await clearStore(STORES.cet);
		for (const item of payload.cet) await put(STORES.cet, item);
	}
	if (payload.review) {
		await clearStore(STORES.review);
		for (const item of payload.review) await put(STORES.review, item);
	}
	if (payload.settings) {
		await clearStore(STORES.settings);
		for (const item of payload.settings) await put(STORES.settings, item);
	}
}

/**
 * localStorage 退化方案：隐私模式下 IndexedDB 可能被禁用，
 * 这时退回 localStorage，保证功能不整体失效。
 */
const FALLBACK_PREFIX = "ryot-study:fallback:";

export async function getAllSafe<T>(store: StoreName): Promise<T[]> {
	try {
		return await getAll<T>(store);
	} catch {
		const raw = window.localStorage.getItem(FALLBACK_PREFIX + store);
		return raw ? (JSON.parse(raw) as T[]) : [];
	}
}

export async function putSafe<T extends { id: string }>(
	store: StoreName,
	value: T,
): Promise<void> {
	try {
		await put(store, value);
	} catch {
		const list = await getAllSafe<T>(store);
		const next = list.filter((i) => i.id !== value.id);
		next.push(value);
		window.localStorage.setItem(FALLBACK_PREFIX + store, JSON.stringify(next));
	}
}

export async function removeSafe(store: StoreName, id: string): Promise<void> {
	try {
		await remove(store, id);
	} catch {
		const list = await getAllSafe<{ id: string }>(store);
		const next = list.filter((i) => i.id !== id);
		window.localStorage.setItem(FALLBACK_PREFIX + store, JSON.stringify(next));
	}
}
