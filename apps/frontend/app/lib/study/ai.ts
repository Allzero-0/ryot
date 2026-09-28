/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：本地规则分析引擎（通用 analyzePlan）
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import dayjs from "dayjs";
import type {
	CetCheckIn,
	GongkaoPlan,
	GongkaoTask,
	KaoyanTask,
	ReviewItem,
	StudySettings,
	TaskStatus,
} from "./types";
import { SUBJECTS, GONGKAO_SUBJECTS, todayString } from "./types";
import { getDueState, masteryScore } from "./review-scheduler";

/**
 * 本地规则分析引擎（不联网、不需要 API Key）。
 *
 * 之所以做成规则而不是接大模型：
 * 1. 离线可用，数据不出本机——考研计划这类个人信息没必要上传；
 * 2. 结果可解释：每条结论都能追溯到具体数字，不会出现模型胡编；
 * 3. 响应是毫秒级的，适合每次打卡后实时刷新。
 *
 * 如果后续要接真实大模型，只需把 `generateInsights` 换成一次请求，
 * 其余分析函数仍可复用。
 */

export interface CheckInAnalysis {
	/** 连续打卡天数 */
	streak: number;
	totalDays: number;
	totalMinutes: number;
	totalWords: number;
	/** 达标天数（同时满足单词量与时长的目标） */
	goalMetDays: number;
	goalRate: number;
	/** 最近 91 天热力图数据 */
	heatmap: { date: string; minutes: number; level: number }[];
	/** 最近 30 天每日时长 */
	trend: { date: string; minutes: number; words: number }[];
	/** 近 7 天 vs 前 7 天，判断是否进入平台期 */
	recent7Avg: number;
	previous7Avg: number;
	isPlateau: boolean;
	/** 五项能力雷达，0-100 */
	ability: { dimension: string; score: number; raw: number }[];
	weakest: string;
	strongest: string;
	/** 预测分数 0-710 */
	predictedScore: number;
	scoreBasis: string;
}

const HEATMAP_DAYS = 91;
const TREND_DAYS = 30;

export function analyzeCheckIns(
	checkIns: CetCheckIn[],
	settings: StudySettings,
): CheckInAnalysis {
	const byDate = new Map<string, CetCheckIn>();
	for (const c of checkIns) byDate.set(c.date, c);
	const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));

	// ── 连续打卡 ────────────────────────────────────────────────
	const today = todayString();
	let streak = 0;
	let cursor = dayjs(today);
	// 今天还没打卡不算断，从昨天往前倒推
	if (!byDate.has(today)) cursor = cursor.subtract(1, "day");
	while (byDate.has(cursor.format("YYYY-MM-DD"))) {
		streak += 1;
		cursor = cursor.subtract(1, "day");
	}

	// ── 热力图 & 趋势 ───────────────────────────────────────────
	const heatmap: CheckInAnalysis["heatmap"] = [];
	for (let i = HEATMAP_DAYS - 1; i >= 0; i--) {
		const date = dayjs(today).subtract(i, "day").format("YYYY-MM-DD");
		const minutes = byDate.get(date)?.minutes ?? 0;
		heatmap.push({ date, minutes, level: heatLevel(minutes) });
	}

	const trend: CheckInAnalysis["trend"] = [];
	for (let i = TREND_DAYS - 1; i >= 0; i--) {
		const date = dayjs(today).subtract(i, "day").format("YYYY-MM-DD");
		const record = byDate.get(date);
		trend.push({
			date,
			minutes: record?.minutes ?? 0,
			words: record?.words ?? 0,
		});
	}

	const last14 = trend.slice(-14);
	const recent7Avg = average(last14.slice(-7).map((t) => t.minutes));
	const previous7Avg = average(last14.slice(0, 7).map((t) => t.minutes));

	// ── 能力雷达（取最近 30 天日均，对照目标归一化）─────────────
	const window = sorted.filter(
		(c) => c.date >= dayjs(today).subtract(29, "day").format("YYYY-MM-DD"),
	);
	const days = Math.max(window.length, 1);
	const avg = (pick: (c: CetCheckIn) => number) =>
		window.reduce((sum, c) => sum + pick(c), 0) / days;

	const ability = [
		{
			dimension: "词汇",
			raw: Math.round(avg((c) => c.words)),
			score: normalize(avg((c) => c.words) / Math.max(settings.dailyWordGoal, 1)),
		},
		{
			dimension: "听力",
			raw: Math.round(avg((c) => c.listening)),
			score: normalize(avg((c) => c.listening) / 30),
		},
		{
			dimension: "阅读",
			raw: Math.round(avg((c) => c.reading) * 10) / 10,
			score: normalize(avg((c) => c.reading) / 2),
		},
		{
			dimension: "写作",
			raw: Math.round(avg((c) => c.writing) * 10) / 10,
			score: normalize((avg((c) => c.writing) * 7) / 2),
		},
		{
			dimension: "翻译",
			raw: Math.round(avg((c) => c.translation) * 10) / 10,
			score: normalize((avg((c) => c.translation) * 7) / 2),
		},
	];

	const ranked = [...ability].sort((a, b) => a.score - b.score);

	const totalMinutes = checkIns.reduce((s, c) => s + c.minutes, 0);
	const totalWords = checkIns.reduce((s, c) => s + c.words, 0);
	const goalMetDays = checkIns.filter(
		(c) =>
			c.words >= settings.dailyWordGoal * 0.8 &&
			c.minutes >= settings.dailyMinutesGoal * 0.8,
	).length;

	const predictions = predictCetScore(checkIns, settings);

	return {
		streak,
		totalDays: checkIns.length,
		totalMinutes,
		totalWords,
		goalMetDays,
		goalRate: checkIns.length ? goalMetDays / checkIns.length : 0,
		heatmap,
		trend,
		recent7Avg,
		previous7Avg,
		isPlateau: previous7Avg > 10 && recent7Avg < previous7Avg * 0.8,
		ability,
		weakest: ranked[0]?.dimension ?? "词汇",
		strongest: ranked[ranked.length - 1]?.dimension ?? "词汇",
		predictedScore: predictions.score,
		scoreBasis: predictions.basis,
	};
}

function heatLevel(minutes: number) {
	if (minutes === 0) return 0;
	if (minutes < 30) return 1;
	if (minutes < 60) return 2;
	if (minutes < 120) return 3;
	return 4;
}

function average(values: number[]) {
	if (values.length === 0) return 0;
	return values.reduce((a, b) => a + b, 0) / values.length;
}

function normalize(ratio: number) {
	return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

/**
 * 四六级分数预测（0-710）。
 *
 * 纯规则模型：以 420 为基线，按「日均时长」「累计词汇量」两项加权上浮，
 * 若用户填过模考分，则与模型值按 4:6 融合——模考是真实信号，权重更高。
 */
export function predictCetScore(
	checkIns: CetCheckIn[],
	settings: StudySettings,
): { score: number; basis: string } {
	if (checkIns.length === 0)
		return { score: 0, basis: "暂无打卡数据，无法预测" };

	const totalWords = checkIns.reduce((s, c) => s + c.words, 0);
	const avgMinutes = average(checkIns.map((c) => c.minutes));

	const intensity = Math.min(avgMinutes / 90, 1); // 日均 90 分钟视为满分强度
	const vocabulary = Math.min(totalWords / 3000, 1); // 累计 3000 词视为饱和

	let model = 420 + intensity * 90 + vocabulary * 80;

	const mocks = checkIns
		.filter((c) => typeof c.mockScore === "number")
		.sort((a, b) => a.date.localeCompare(b.date));

	let basis = `基线 420 + 强度 +${Math.round(intensity * 90)} + 词汇 +${Math.round(vocabulary * 80)}`;
	if (mocks.length > 0) {
		const latest = mocks[mocks.length - 1].mockScore ?? model;
		model = model * 0.4 + latest * 0.6;
		basis += `，与最近一次模考 ${latest} 分按 4:6 融合`;
	}

	return {
		score: Math.max(250, Math.min(710, Math.round(model))),
		basis,
	};
}

// ── 考研计划分析 ──────────────────────────────────────────────────────

/**
 * 计划分析只需要这几个字段，考研任务和公考任务都能直接传进来，
 * 所以这里用结构类型而不是具体接口，两边共用同一套算法。
 */
export interface PlanLikeTask {
	id: string;
	subject: string;
	title: string;
	startDate: string;
	endDate: string;
	targetHours: number;
	doneHours: number;
	status: TaskStatus;
	/** 公考任务归属到某一套计划；考研任务没有这个字段 */
	planId?: string;
}

export interface KaoyanAnalysis {
	remainingDays: number;
	totalTargetHours: number;
	totalDoneHours: number;
	remainingHours: number;
	overallProgress: number;
	/** 按科目聚合 */
	bySubject: {
		subject: string;
		targetHours: number;
		doneHours: number;
		progress: number;
		taskCount: number;
		doneCount: number;
		/** 子项拆分（按省份 / 试卷类型），展开后可见 */
		children?: {
			label: string;
			targetHours: number;
			doneHours: number;
			progress: number;
			taskCount: number;
			doneCount: number;
		}[];
	}[];
	/** 按剩余天数摊到每天需要的小时数 */
	requiredHoursPerDay: number;
	/** 用户设定的每日可用小时数 */
	availableHoursPerDay: number;
	risk: "低" | "中" | "高";
	riskReason: string;
	/** 已延期且尚未完成的任务 */
	delayedTasks: KaoyanTask[];
	/** 甘特图数据 */
	gantt: {
		id: string;
		title: string;
		subject: string;
		start: number;
		end: number;
		progress: number;
		status: string;
	}[];
}

/**
 * 计划类分析的通用实现。
 *
 * 考研、公考事业编用的是同一套算法：按科目聚合时长 → 算总体进度 →
 * 用「剩余小时数 / 剩余天数」得到每日所需 → 与用户设定的每日上限比较得出风险等级。
 * 差异只有科目列表和考试日期，所以抽成这一个函数，两边共用。
 */
export function analyzePlan(input: {
	tasks: PlanLikeTask[];
	examDate: string;
	dailyMinutesGoal: number;
	subjects: readonly string[];
	/** 科目进度的子项拆分，例如按省份 / 试卷类型 */
	groupBy?: (task: PlanLikeTask) => string | undefined;
}): KaoyanAnalysis {
	const { tasks, examDate, dailyMinutesGoal, subjects, groupBy } = input;
	const today = todayString();
	const remainingDays = Math.max(dayjs(examDate).diff(today, "day"), 0);

	const totalTargetHours = tasks.reduce((s, t) => s + t.targetHours, 0);
	const totalDoneHours = tasks.reduce((s, t) => s + t.doneHours, 0);
	const remainingHours = Math.max(totalTargetHours - totalDoneHours, 0);

	const bySubject = subjects
		.map((subject) => {
			const list = tasks.filter((t) => t.subject === subject);
			const targetHours = list.reduce((s, t) => s + t.targetHours, 0);
			const doneHours = list.reduce((s, t) => s + t.doneHours, 0);

			let children: KaoyanAnalysis["bySubject"][number]["children"];
			if (groupBy) {
				const grouped = new Map<string, PlanLikeTask[]>();
				for (const task of list) {
					const key = groupBy(task) ?? "未分类";
					const bucket = grouped.get(key) ?? [];
					bucket.push(task);
					grouped.set(key, bucket);
				}
				children = [...grouped.entries()].map(([label, items]) => {
					const target = items.reduce((s, t) => s + t.targetHours, 0);
					const done = items.reduce((s, t) => s + t.doneHours, 0);
					return {
						label,
						targetHours: target,
						doneHours: done,
						progress: target ? Math.round((done / target) * 100) : 0,
						taskCount: items.length,
						doneCount: items.filter((t) => t.status === "已完成").length,
					};
				});
			}

			return {
				subject,
				targetHours,
				doneHours,
				progress: targetHours ? Math.round((doneHours / targetHours) * 100) : 0,
				taskCount: list.length,
				doneCount: list.filter((t) => t.status === "已完成").length,
				children,
			};
		})
		.filter((s) => s.taskCount > 0);

	const availableHoursPerDay = dailyMinutesGoal / 60;
	const requiredHoursPerDay = remainingDays
		? remainingHours / remainingDays
		: remainingHours;

	let risk: KaoyanAnalysis["risk"] = "低";
	let riskReason = "";
	if (requiredHoursPerDay <= availableHoursPerDay * 0.7) {
		risk = "低";
		riskReason = `剩余任务摊到每天约 ${requiredHoursPerDay.toFixed(1)} 小时，低于你设定的日均 ${availableHoursPerDay.toFixed(1)} 小时，节奏健康。`;
	} else if (requiredHoursPerDay <= availableHoursPerDay) {
		risk = "中";
		riskReason = `剩余任务摊到每天约 ${requiredHoursPerDay.toFixed(1)} 小时，已接近日均上限 ${availableHoursPerDay.toFixed(1)} 小时，需要保持稳定输出。`;
	} else {
		risk = "高";
		riskReason = `剩余任务摊到每天需要 ${requiredHoursPerDay.toFixed(1)} 小时，超过你设定的日均 ${availableHoursPerDay.toFixed(1)} 小时，建议缩减任务量或上调每日目标。`;
	}

	const base = dayjs(today);
	const gantt = tasks.map((t) => ({
		id: t.id,
		title: t.title,
		subject: t.subject,
		start: Math.max(dayjs(t.startDate).diff(base, "day"), 0),
		end: Math.max(dayjs(t.endDate).diff(base, "day"), 0),
		progress: t.targetHours
			? Math.round((t.doneHours / t.targetHours) * 100)
			: 0,
		status: t.status,
	}));

	return {
		remainingDays,
		totalTargetHours,
		totalDoneHours,
		remainingHours,
		overallProgress: totalTargetHours
			? Math.round((totalDoneHours / totalTargetHours) * 100)
			: 0,
		bySubject,
		requiredHoursPerDay,
		availableHoursPerDay,
		risk,
		riskReason,
		delayedTasks: tasks.filter((t) => t.status === "已延期") as KaoyanTask[],
		gantt,
	};
}

/** 考研计划：沿用原逻辑，科目取考研五科，考试日期取总览里的考研日期 */
export function analyzeKaoyan(
	tasks: KaoyanTask[],
	settings: StudySettings,
): KaoyanAnalysis {
	return analyzePlan({
		tasks,
		examDate: settings.examDate,
		dailyMinutesGoal: settings.dailyMinutesGoal,
		subjects: SUBJECTS,
	});
}

/**
 * 公考 / 事业编计划：算法与考研完全一致，只换科目列表和考试日期。
 *
 * 传入的是「当前选中计划」的任务，所以多套计划的数据天然互不干扰。
 */
export function analyzeGongkao(
	tasks: GongkaoTask[],
	plan: GongkaoPlan | undefined,
	settings: StudySettings,
	/** 全部计划，用于把科目进度拆成「按省份 / 试卷类型」的子项 */
	allPlans: GongkaoPlan[] = [],
): KaoyanAnalysis {
	const planName = new Map(allPlans.map((p) => [p.id, p.name]));
	return analyzePlan({
		tasks,
		examDate: plan?.examDate ?? todayString(),
		dailyMinutesGoal: settings.dailyMinutesGoal,
		subjects: GONGKAO_SUBJECTS,
		groupBy: (task) => (task.planId ? planName.get(task.planId) : undefined),
	});
}

// ── 复习队列分析 ──────────────────────────────────────────────────────

export interface ReviewAnalysis {
	total: number;
	overdue: number;
	today: number;
	upcoming: number;
	mastered: number;
	avgMastery: number;
	/** 未来 7 天每天待复习数量 */
	load: { date: string; count: number }[];
	worstSubjects: { subject: string; avgMastery: number }[];
}

export function analyzeReviews(items: ReviewItem[]): ReviewAnalysis {
	const counts = { overdue: 0, today: 0, upcoming: 0, mastered: 0 };
	for (const item of items) counts[getDueState(item)] += 1;

	const subjectMap = new Map<string, number[]>();
	for (const item of items) {
		const list = subjectMap.get(item.subject) ?? [];
		list.push(masteryScore(item));
		subjectMap.set(item.subject, list);
	}
	const worstSubjects = [...subjectMap.entries()]
		.map(([subject, scores]) => ({
			subject,
			avgMastery: Math.round(average(scores)),
		}))
		.sort((a, b) => a.avgMastery - b.avgMastery);

	const load: ReviewAnalysis["load"] = [];
	for (let i = 0; i < 7; i++) {
		const date = dayjs(todayString()).add(i, "day").format("YYYY-MM-DD");
		load.push({
			date,
			count: items.filter((item) => item.nextReviewAt === date).length,
		});
	}

	return {
		total: items.length,
		...counts,
		avgMastery: items.length
			? Math.round(average(items.map((i) => masteryScore(i))))
			: 0,
		load,
		worstSubjects,
	};
}

// ── 综合洞察 ──────────────────────────────────────────────────────────

export interface Insight {
	title: string;
	detail: string;
	severity: "good" | "info" | "warn" | "danger";
	action?: string;
}

export function generateInsights(input: {
	checkIns: CetCheckIn[];
	tasks: KaoyanTask[];
	reviews: ReviewItem[];
	settings: StudySettings;
}): Insight[] {
	const { checkIns, tasks, reviews, settings } = input;
	const cet = analyzeCheckIns(checkIns, settings);
	const kaoyan = analyzeKaoyan(tasks, settings);
	const review = analyzeReviews(reviews);
	const insights: Insight[] = [];

	const daysToCet = Math.max(dayjs(settings.cetExamDate).diff(todayString(), "day"), 0);

	if (cet.streak >= 7)
		insights.push({
			title: `已连续打卡 ${cet.streak} 天`,
			detail: `近 30 天累计 ${Math.round(cet.totalMinutes / 60)} 小时，达标率 ${Math.round(cet.goalRate * 100)}%。保持这个节奏。`,
			severity: "good",
		});
	else if (cet.streak === 0 && checkIns.length > 0)
		insights.push({
			title: "打卡断档了",
			detail: "连续性一旦断掉，重建习惯的成本比维持高得多。今天先做 15 分钟最小剂量。",
			severity: "warn",
			action: "去打卡",
		});

	if (cet.isPlateau)
		insights.push({
			title: "进入平台期",
			detail: `近 7 天日均 ${Math.round(cet.recent7Avg)} 分钟，比上一个 7 天的 ${Math.round(cet.previous7Avg)} 分钟下滑超过 20%。通常意味着材料难度上升或动力下降，建议换题型而不是硬耗时间。`,
			severity: "warn",
		});

	insights.push({
		title: `最薄弱的环节是「${cet.weakest}」`,
		detail: `五项能力中「${cet.strongest}」最强（${cet.ability.find((a) => a.dimension === cet.strongest)?.score ?? 0} 分），「${cet.weakest}」只有 ${cet.ability.find((a) => a.dimension === cet.weakest)?.score ?? 0} 分。边际收益最高的是补短板。`,
		severity: cet.ability.find((a) => a.dimension === cet.weakest)?.score ?? 0 < 40 ? "warn" : "info",
		action: "查看能力雷达",
	});

	if (checkIns.length >= 5)
		insights.push({
			title: `预测 ${settings.cetLevel} 得分约 ${cet.predictedScore} 分`,
			detail: `${cet.scoreBasis}。距离考试还有 ${daysToCet} 天。`,
			severity: cet.predictedScore >= 425 ? "good" : "danger",
		});

	if (tasks.length > 0)
		insights.push({
			title: `考研计划风险：${kaoyan.risk}`,
			detail: kaoyan.riskReason,
			severity:
				kaoyan.risk === "高" ? "danger" : kaoyan.risk === "中" ? "warn" : "good",
		});

	if (kaoyan.delayedTasks.length > 0)
		insights.push({
			title: `${kaoyan.delayedTasks.length} 个任务已延期`,
			detail: `例如「${kaoyan.delayedTasks[0].title}」。延期任务会挤占后面的日程，要么重排时间，要么砍掉。`,
			severity: "warn",
			action: "调整计划",
		});

	const weakestSubject = kaoyan.bySubject
		.filter((s) => s.taskCount > 0)
		.sort((a, b) => a.progress - b.progress)[0];
	if (weakestSubject && weakestSubject.progress < 40)
		insights.push({
			title: `「${weakestSubject.subject}」进度只有 ${weakestSubject.progress}%`,
			detail: `该科目 ${weakestSubject.doneCount}/${weakestSubject.taskCount} 个任务已完成，明显落后于其他科目。`,
			severity: "warn",
		});

	if (review.overdue > 0)
		insights.push({
			title: `${review.overdue} 个复习项已逾期`,
			detail: "逾期项越堆越多会失去意义，建议今天先清掉最早的那批。",
			severity: "danger",
			action: "去复习",
		});

	if (review.worstSubjects.length > 0)
		insights.push({
			title: `「${review.worstSubjects[0].subject}」掌握度最低`,
			detail: `平均掌握度 ${review.worstSubjects[0].avgMastery} 分，整体平均 ${review.avgMastery} 分。`,
			severity: review.worstSubjects[0].avgMastery < 40 ? "warn" : "info",
		});

	const busiest = [...review.load].sort((a, b) => b.count - a.count)[0];
	if (busiest && busiest.count > 8)
		insights.push({
			title: `${busiest.date} 复习量过载`,
			detail: `当天有 ${busiest.count} 项待复习，超过 8 项时建议提前分摊——可以在复习时给高分项拉长间隔。`,
			severity: "info",
		});

	return insights;
}
