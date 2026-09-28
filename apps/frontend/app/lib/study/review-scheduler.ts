/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：SM-2 间隔重复复习调度
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import dayjs from "dayjs";
import type { ReviewItem, ReviewRecord, ReviewSource } from "./types";
import { newId, todayString } from "./types";

/**
 * SM-2 间隔重复调度（艾宾浩斯遗忘曲线的工程化实现）。
 *
 * 规则：
 * - 评分 q >= 3（想起来了）→ 进入下一轮，间隔按难度因子放大
 * - 评分 q < 3（忘了）→ 打回第 1 轮，间隔重置为 1 天
 * - 难度因子 ease 随评分微调，下限 1.3（太低的因子会让间隔永远涨不上去）
 *
 * 前两轮的间隔固定为 1 天和 6 天，这是 SuperMemo 原始论文给出的经验值。
 */
const MIN_EASE = 1.3;
const FIRST_INTERVAL = 1;
const SECOND_INTERVAL = 6;

export function createReviewItem(input: {
	title: string;
	subject: string;
	source: ReviewSource;
}): ReviewItem {
	return {
		id: newId(),
		title: input.title,
		subject: input.subject,
		source: input.source,
		createdAt: todayString(),
		stage: 0,
		ease: 2.5,
		intervalDays: 0,
		nextReviewAt: todayString(),
		history: [],
	};
}

/** 按 SM-2 记一次复习反馈，返回更新后的条目 */
export function applyReview(item: ReviewItem, quality: number): ReviewItem {
	const q = Math.max(0, Math.min(5, Math.round(quality)));
	const today = todayString();
	const record: ReviewRecord = { date: today, quality: q };

	let ease = item.ease;
	// ease 的更新公式来自 SM-2：EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
	ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
	ease = Math.max(MIN_EASE, Math.round(ease * 100) / 100);

	let stage = item.stage;
	let intervalDays: number;

	if (q < 3) {
		// 忘了：回到起点
		stage = 0;
		intervalDays = FIRST_INTERVAL;
	} else {
		stage = item.stage + 1;
		if (stage === 1) intervalDays = FIRST_INTERVAL;
		else if (stage === 2) intervalDays = SECOND_INTERVAL;
		else intervalDays = Math.round(item.intervalDays * ease) || SECOND_INTERVAL;
	}

	return {
		...item,
		stage,
		ease,
		intervalDays,
		lastReviewedAt: today,
		nextReviewAt: dayjs(today).add(intervalDays, "day").format("YYYY-MM-DD"),
		history: [...item.history, record],
	};
}

export type DueState = "overdue" | "today" | "upcoming" | "mastered";

export function getDueState(item: ReviewItem): DueState {
	const today = todayString();
	if (item.stage >= 5 && item.intervalDays >= 30) return "mastered";
	if (item.nextReviewAt < today) return "overdue";
	if (item.nextReviewAt === today) return "today";
	return "upcoming";
}

export const DUE_STATE_LABELS: Record<DueState, string> = {
	overdue: "已逾期",
	today: "今日待复习",
	upcoming: "未到期",
	mastered: "已掌握",
};

export const DUE_STATE_COLORS: Record<DueState, string> = {
	overdue: "red",
	today: "orange",
	upcoming: "blue",
	mastered: "green",
};

/** 掌握度 0-100：由轮次 + 难度因子 + 历史通过率综合得出 */
export function masteryScore(item: ReviewItem): number {
	if (item.history.length === 0) return 0;
	const passRate =
		item.history.filter((h) => h.quality >= 3).length / item.history.length;
	const stageScore = Math.min(item.stage, 6) / 6;
	const easeScore = Math.min(Math.max((item.ease - MIN_EASE) / 1.2, 0), 1);
	return Math.round((stageScore * 0.5 + passRate * 0.3 + easeScore * 0.2) * 100);
}

export function sortByUrgency(items: ReviewItem[]): ReviewItem[] {
	const weight: Record<DueState, number> = {
		overdue: 0,
		today: 1,
		upcoming: 2,
		mastered: 3,
	};
	return [...items].sort((a, b) => {
		const byState = weight[getDueState(a)] - weight[getDueState(b)];
		if (byState !== 0) return byState;
		return a.nextReviewAt.localeCompare(b.nextReviewAt);
	});
}
