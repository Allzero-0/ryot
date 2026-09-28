/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：学习模块全局状态与增删改
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	DEFAULT_SETTINGS,
	type CetCheckIn,
	type GongkaoPlan,
	type GongkaoTask,
	type KaoyanTask,
	type ReviewItem,
	type StudySettings,
	type GongkaoTrack,
	buildGongkaoPlanName,
	defaultExamDateForTrack,
	newId,
} from "./types";
import { STORES, exportAll, getAllSafe, importAll, putSafe, removeSafe } from "./storage";
import { applyReview, createReviewItem } from "./review-scheduler";
import { buildDemoData } from "./seed";

const SETTINGS_ID = "default";

export interface StudyStore {
	loading: boolean;
	tasks: KaoyanTask[];
	checkIns: CetCheckIn[];
	reviews: ReviewItem[];
	settings: StudySettings;
	addTask: (task: Omit<KaoyanTask, "id" | "createdAt">) => Promise<void>;
	updateTask: (task: KaoyanTask) => Promise<void>;
	removeTask: (id: string) => Promise<void>;
	upsertCheckIn: (checkIn: Omit<CetCheckIn, "id">) => Promise<void>;
	removeCheckIn: (id: string) => Promise<void>;
	addReview: (input: {
		title: string;
		subject: string;
		source: ReviewItem["source"];
	}) => Promise<void>;
	gradeReview: (id: string, quality: number) => Promise<void>;
	removeReview: (id: string) => Promise<void>;
	updateSettings: (patch: Partial<StudySettings>) => Promise<void>;
	/** 导出全部数据为 JSON 字符串，用于备份 / 换设备 */
	// ── 公考 / 事业编 ────────────────────────────────────────────
	/** 全部公考计划（多套并存，互不覆盖） */
	gongkaoPlans: GongkaoPlan[];
	/** 全部公考任务 */
	gongkaoTasks: GongkaoTask[];
	/** 当前选中的计划 id */
	activeGongkaoPlanId: string | undefined;
	setActiveGongkaoPlan: (planId: string) => Promise<void>;
	createGongkaoPlan: (input: {
		track: GongkaoTrack;
		province?: string;
		paperType: string;
		examDate?: string;
	}) => Promise<GongkaoPlan>;
	updateGongkaoPlan: (plan: GongkaoPlan) => Promise<void>;
	removeGongkaoPlan: (planId: string) => Promise<void>;
	addGongkaoTask: (task: Omit<GongkaoTask, "id" | "createdAt">) => Promise<void>;
	updateGongkaoTask: (task: GongkaoTask) => Promise<void>;
	removeGongkaoTask: (id: string) => Promise<void>;
	exportBackup: () => Promise<string>;
	/** 从备份 JSON 恢复，会覆盖现有数据 */
	importBackup: (raw: string) => Promise<void>;
	loadDemoData: () => Promise<void>;
	resetAll: () => Promise<void>;
}

const StudyContext = createContext<StudyStore | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
	const [loading, setLoading] = useState(true);
	const [tasks, setTasks] = useState<KaoyanTask[]>([]);
	const [gongkaoTasks, setGongkaoTasks] = useState<GongkaoTask[]>([]);
	const [checkIns, setCheckIns] = useState<CetCheckIn[]>([]);
	const [reviews, setReviews] = useState<ReviewItem[]>([]);
	const [settings, setSettings] = useState<StudySettings>(DEFAULT_SETTINGS);

	const refresh = useCallback(async () => {
		const [t, g, c, r, s] = await Promise.all([
			getAllSafe<KaoyanTask>(STORES.kaoyan),
			getAllSafe<GongkaoTask>(STORES.gongkao),
			getAllSafe<CetCheckIn>(STORES.cet),
			getAllSafe<ReviewItem>(STORES.review),
			getAllSafe<StudySettings & { id: string }>(STORES.settings),
		]);
		setTasks(t.sort((a, b) => a.startDate.localeCompare(b.startDate)));
		setGongkaoTasks(g.sort((a, b) => a.startDate.localeCompare(b.startDate)));
		setCheckIns(c.sort((a, b) => a.date.localeCompare(b.date)));
		setReviews(r);
		const stored = s.find((i) => i.id === SETTINGS_ID);
		if (stored) {
			const { id: _id, ...rest } = stored;
			setSettings({ ...DEFAULT_SETTINGS, ...rest });
		}
	}, []);

	// IndexedDB 只在浏览器里存在，所以数据加载放在挂载后（SSR 阶段保持空态）
	useEffect(() => {
		let cancelled = false;
		refresh()
			.catch(() => undefined)
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [refresh]);

	const addTask: StudyStore["addTask"] = useCallback(async (task) => {
		const next: KaoyanTask = {
			...task,
			id: newId(),
			createdAt: new Date().toISOString(),
		};
		await putSafe(STORES.kaoyan, next);
		setTasks((current) =>
			[...current, next].sort((a, b) => a.startDate.localeCompare(b.startDate)),
		);
	}, []);

	const updateTask: StudyStore["updateTask"] = useCallback(async (task) => {
		await putSafe(STORES.kaoyan, task);
		setTasks((current) => current.map((t) => (t.id === task.id ? task : t)));
	}, []);

	const removeTask: StudyStore["removeTask"] = useCallback(async (id) => {
		await removeSafe(STORES.kaoyan, id);
		setTasks((current) => current.filter((t) => t.id !== id));
	}, []);

	const upsertCheckIn: StudyStore["upsertCheckIn"] = useCallback(
		async (checkIn) => {
			// 同一天只保留一条：以 date + level 作为业务主键
			const existing = checkIns.find(
				(c) => c.date === checkIn.date && c.level === checkIn.level,
			);
			const next: CetCheckIn = { ...checkIn, id: existing?.id ?? newId() };
			await putSafe(STORES.cet, next);
			setCheckIns((current) => {
				const rest = current.filter((c) => c.id !== next.id);
				return [...rest, next].sort((a, b) => a.date.localeCompare(b.date));
			});
		},
		[checkIns],
	);

	const removeCheckIn: StudyStore["removeCheckIn"] = useCallback(async (id) => {
		await removeSafe(STORES.cet, id);
		setCheckIns((current) => current.filter((c) => c.id !== id));
	}, []);

	const addReview: StudyStore["addReview"] = useCallback(async (input) => {
		const item = createReviewItem(input);
		await putSafe(STORES.review, item);
		setReviews((current) => [...current, item]);
	}, []);

	const gradeReview: StudyStore["gradeReview"] = useCallback(
		async (id, quality) => {
			const target = reviews.find((r) => r.id === id);
			if (!target) return;
			const updated = applyReview(target, quality);
			await putSafe(STORES.review, updated);
			setReviews((current) => current.map((r) => (r.id === id ? updated : r)));
		},
		[reviews],
	);

	const removeReview: StudyStore["removeReview"] = useCallback(async (id) => {
		await removeSafe(STORES.review, id);
		setReviews((current) => current.filter((r) => r.id !== id));
	}, []);

	const updateSettings: StudyStore["updateSettings"] = useCallback(
		async (patch) => {
			const next = { ...settings, ...patch };
			setSettings(next);
			await putSafe(STORES.settings, { ...next, id: SETTINGS_ID });
		},
		[settings],
	);

	/**
	 * 导出备份。装成 App 之后，在系统设置里「清除应用数据」会把 IndexedDB 一起清掉，
	 * 所以必须给用户一个能自己导出 JSON 的出口。
	 */
	// ── 公考 / 事业编 ────────────────────────────────────────────
	// 计划存在 settings 里（随备份一起导出），任务存在独立的 gongkao store，
	// 通过 planId 归属，切换计划只是换筛选条件，不会动到别的计划的数据。

	const setActiveGongkaoPlan: StudyStore["setActiveGongkaoPlan"] = useCallback(
		async (planId) => {
			await updateSettings({ activeGongkaoPlanId: planId });
		},
		[updateSettings],
	);

	const createGongkaoPlan: StudyStore["createGongkaoPlan"] = useCallback(
		async (input) => {
			const plan: GongkaoPlan = {
				id: newId(),
				name: buildGongkaoPlanName(input),
				track: input.track,
				province: input.track === "国考" ? undefined : input.province,
				paperType: input.paperType,
				examDate: input.examDate || defaultExamDateForTrack(input.track),
				createdAt: new Date().toISOString(),
			};
			const nextPlans = [...settings.gongkaoPlans, plan];
			await updateSettings({
				gongkaoPlans: nextPlans,
				activeGongkaoPlanId: plan.id,
			});
			return plan;
		},
		[settings.gongkaoPlans, updateSettings],
	);

	const updateGongkaoPlan: StudyStore["updateGongkaoPlan"] = useCallback(
		async (plan) => {
			await updateSettings({
				gongkaoPlans: settings.gongkaoPlans.map((p) =>
					p.id === plan.id ? plan : p,
				),
			});
		},
		[settings.gongkaoPlans, updateSettings],
	);

	const removeGongkaoPlan: StudyStore["removeGongkaoPlan"] = useCallback(
		async (planId) => {
			// 连带删掉这套计划下的任务，避免留下孤儿数据
			for (const task of gongkaoTasks.filter((t) => t.planId === planId))
				await removeSafe(STORES.gongkao, task.id);
			setGongkaoTasks((current) => current.filter((t) => t.planId !== planId));
			const nextPlans = settings.gongkaoPlans.filter((p) => p.id !== planId);
			await updateSettings({
				gongkaoPlans: nextPlans,
				activeGongkaoPlanId:
					settings.activeGongkaoPlanId === planId
						? nextPlans[0]?.id
						: settings.activeGongkaoPlanId,
			});
		},
		[settings.gongkaoPlans, settings.activeGongkaoPlanId, gongkaoTasks, updateSettings],
	);

	const addGongkaoTask: StudyStore["addGongkaoTask"] = useCallback(
		async (task) => {
			const next: GongkaoTask = {
				...task,
				id: newId(),
				createdAt: new Date().toISOString(),
			};
			await putSafe(STORES.gongkao, next);
			setGongkaoTasks((current) =>
				[...current, next].sort((a, b) => a.startDate.localeCompare(b.startDate)),
			);
		},
		[],
	);

	const updateGongkaoTask: StudyStore["updateGongkaoTask"] = useCallback(
		async (task) => {
			await putSafe(STORES.gongkao, task);
			setGongkaoTasks((current) =>
				current.map((t) => (t.id === task.id ? task : t)),
			);
		},
		[],
	);

	const removeGongkaoTask: StudyStore["removeGongkaoTask"] = useCallback(
		async (id) => {
			await removeSafe(STORES.gongkao, id);
			setGongkaoTasks((current) => current.filter((t) => t.id !== id));
		},
		[],
	);

	const exportBackup: StudyStore["exportBackup"] = useCallback(async () => {
		const payload = await exportAll();
		return JSON.stringify(payload, null, 2);
	}, []);

	const importBackup: StudyStore["importBackup"] = useCallback(
		async (raw) => {
			const payload = JSON.parse(raw) as Parameters<typeof importAll>[0];
			if (!payload || typeof payload !== "object")
				throw new Error("备份文件格式不对");
			await importAll(payload);
			await refresh();
		},
		[refresh],
	);

	const loadDemoData: StudyStore["loadDemoData"] = useCallback(async () => {
		const demo = buildDemoData();
		for (const task of demo.tasks) await putSafe(STORES.kaoyan, task);
		for (const checkIn of demo.checkIns) await putSafe(STORES.cet, checkIn);
		for (const review of demo.reviews) await putSafe(STORES.review, review);
		await refresh();
	}, [refresh]);

	const resetAll: StudyStore["resetAll"] = useCallback(async () => {
		for (const id of tasks) await removeSafe(STORES.kaoyan, id.id);
		for (const id of gongkaoTasks) await removeSafe(STORES.gongkao, id.id);
		for (const id of checkIns) await removeSafe(STORES.cet, id.id);
		for (const id of reviews) await removeSafe(STORES.review, id.id);
		setTasks([]);
		setGongkaoTasks([]);
		setCheckIns([]);
		setReviews([]);
		await updateSettings({ gongkaoPlans: [], activeGongkaoPlanId: undefined });
	}, [tasks, gongkaoTasks, checkIns, reviews, updateSettings]);

	const value = useMemo<StudyStore>(
		() => ({
			loading,
			tasks,
			gongkaoPlans: settings.gongkaoPlans,
			gongkaoTasks,
			activeGongkaoPlanId: settings.activeGongkaoPlanId,
			setActiveGongkaoPlan,
			createGongkaoPlan,
			updateGongkaoPlan,
			removeGongkaoPlan,
			addGongkaoTask,
			updateGongkaoTask,
			removeGongkaoTask,
			checkIns,
			reviews,
			settings,
			addTask,
			updateTask,
			removeTask,
			upsertCheckIn,
			removeCheckIn,
			addReview,
			gradeReview,
			removeReview,
			updateSettings,
			exportBackup,
			importBackup,
			loadDemoData,
			resetAll,
		}),
		[
			loading,
			tasks,
			settings.gongkaoPlans,
			settings.activeGongkaoPlanId,
			gongkaoTasks,
			setActiveGongkaoPlan,
			createGongkaoPlan,
			updateGongkaoPlan,
			removeGongkaoPlan,
			addGongkaoTask,
			updateGongkaoTask,
			removeGongkaoTask,
			checkIns,
			reviews,
			settings,
			addTask,
			updateTask,
			removeTask,
			upsertCheckIn,
			removeCheckIn,
			addReview,
			gradeReview,
			removeReview,
			updateSettings,
			exportBackup,
			importBackup,
			loadDemoData,
			resetAll,
		],
	);

	return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyStore {
	const store = useContext(StudyContext);
	if (!store)
		throw new Error("useStudy 必须在 <StudyProvider> 内部使用");
	return store;
}
