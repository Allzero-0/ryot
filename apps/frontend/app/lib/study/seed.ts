/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：示例数据生成
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import dayjs from "dayjs";
import { applyReview, createReviewItem } from "./review-scheduler";
import type { CetCheckIn, KaoyanTask, ReviewItem, Subject } from "./types";
import { SUBJECTS, newId, todayString } from "./types";

/**
 * 示例数据生成器。
 *
 * 首次打开时图表全空很难看出这个模块能干什么，所以提供一键填充。
 * 数据用带随机波动的方式生成，尽量贴近真实打卡曲线（周末多、周三少、偶尔断档）。
 */

/** 简单的确定性伪随机，保证每次生成的示例数据形态稳定 */
function makeRandom(seed: number) {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

const TASK_TEMPLATES: { subject: Subject; title: string; hours: number }[] = [
	{ subject: "数学", title: "高等数学 基础轮（极限 / 导数 / 积分）", hours: 120 },
	{ subject: "数学", title: "线性代数 强化轮（矩阵 / 特征值）", hours: 60 },
	{ subject: "数学", title: "概率论与数理统计", hours: 45 },
	{ subject: "英语", title: "考研英语 词汇 5500 一轮", hours: 50 },
	{ subject: "英语", title: "历年真题阅读精读（2010-2025）", hours: 80 },
	{ subject: "英语", title: "作文模板整理与背诵", hours: 30 },
	{ subject: "政治", title: "马原 + 毛中特 知识点梳理", hours: 70 },
	{ subject: "政治", title: "肖四肖八 刷题与背诵", hours: 40 },
	{ subject: "专业课", title: "专业课教材 通读 + 笔记", hours: 90 },
	{ subject: "专业课", title: "院校真题 专题训练", hours: 55 },
];

export function buildDemoData(): {
	tasks: KaoyanTask[];
	checkIns: CetCheckIn[];
	reviews: ReviewItem[];
} {
	const random = makeRandom(20260927);
	const today = dayjs(todayString());

	// ── 考研计划：从 60 天前排到考试前 ──────────────────────────
	const tasks: KaoyanTask[] = TASK_TEMPLATES.map((template, index) => {
		const start = today.subtract(60 - index * 6, "day");
		const end = start.add(20 + Math.floor(random() * 15), "day");
		const progressRatio = Math.min(random() * 1.1, 1);
		const doneHours = Math.round(template.hours * progressRatio * 0.8);
		const status: KaoyanTask["status"] =
			doneHours >= template.hours
				? "已完成"
				: end.isBefore(today)
					? "已延期"
					: doneHours > 0
						? "进行中"
						: "未开始";
		return {
			id: newId(),
			subject: template.subject,
			title: template.title,
			startDate: start.format("YYYY-MM-DD"),
			endDate: end.format("YYYY-MM-DD"),
			targetHours: template.hours,
			doneHours,
			status,
			priority: (((index % 3) + 1) as KaoyanTask["priority"]),
			createdAt: start.toISOString(),
		};
	});

	// ── 打卡：最近 75 天 ─────────────────────────────────────────
	const checkIns: CetCheckIn[] = [];
	for (let i = 74; i >= 0; i--) {
		const date = today.subtract(i, "day");
		const weekday = date.day();
		// 周末多学、周三容易断档
		const skipChance = weekday === 3 ? 0.35 : weekday === 0 || weekday === 6 ? 0.08 : 0.15;
		if (random() < skipChance) continue;
		const base = 45 + random() * 75;
		const weekendBoost = weekday === 0 || weekday === 6 ? 30 : 0;
		const minutes = Math.round(base + weekendBoost);
		checkIns.push({
			id: newId(),
			date: date.format("YYYY-MM-DD"),
			level: "CET4",
			words: Math.round(40 + random() * 90),
			listening: Math.round(10 + random() * 40),
			reading: Math.round(random() * 3),
			writing: random() > 0.7 ? 1 : 0,
			translation: random() > 0.75 ? 1 : 0,
			minutes,
			// 每隔半个月安排一次模考
			mockScore:
				i % 15 === 0 ? Math.round(380 + random() * 120 + (74 - i) * 0.6) : undefined,
		});
	}

	// ── 复习条目 ────────────────────────────────────────────────
	const reviewSeeds: { title: string; subject: string; source: ReviewItem["source"] }[] = [
		{ title: "洛必达法则的 7 种变形", subject: "数学", source: "考研" },
		{ title: "矩阵相似对角化的判定条件", subject: "数学", source: "考研" },
		{ title: "英语高频词根 -spect / -dict", subject: "英语", source: "四六级" },
		{ title: "虚拟语气三类时态结构", subject: "英语", source: "四六级" },
		{ title: "马原：生产力与生产关系的辩证关系", subject: "政治", source: "考研" },
		{ title: "新民主主义革命三大法宝", subject: "政治", source: "考研" },
		{ title: "模电：负反馈四种组态判断", subject: "专业课", source: "课程" },
		{ title: "数电：卡诺图化简步骤", subject: "专业课", source: "课程" },
		{ title: "阅读理解题干关键词定位法", subject: "英语", source: "四六级" },
		{ title: "泰勒公式展开的余项形式", subject: "数学", source: "考研" },
	];

	const reviews: ReviewItem[] = reviewSeeds.map((seed, index) => {
		let item = createReviewItem({
			title: seed.title,
			subject: seed.subject,
			source: seed.source,
		});
		// 生成 1-4 次历史复习记录，制造不同的到期状态
		const rounds = 1 + Math.floor(random() * 4);
		for (let r = 0; r < rounds; r++) {
			const quality = random() > 0.25 ? 4 : 2;
			item = applyReview(item, quality);
		}
		// 把一部分条目挪到过去，制造逾期项
		const offset = index % 3 === 0 ? -1 - Math.floor(random() * 5) : 0;
		if (offset !== 0)
			item = {
				...item,
				nextReviewAt: dayjs(item.nextReviewAt).add(offset, "day").format("YYYY-MM-DD"),
			};
		return item;
	});

	return { tasks, checkIns, reviews };
}

export const DEMO_SUBJECT_COUNT = SUBJECTS.length;
