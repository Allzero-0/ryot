/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：学习模块数据类型与考试试卷目录
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
/**
 * 学习模块的数据模型。
 *
 * 这一层刻意不依赖 ryot 后端的 GraphQL —— 考研计划、四六级打卡、复习队列
 * 都是「自己的事」，走浏览器 IndexedDB 即可，因此本模块在没有 Rust 后端、
 * 没有登录会话的情况下也能独立运行。
 */

/** 考研科目 */
export const SUBJECTS = ["政治", "英语", "数学", "专业课", "其他"] as const;
export type Subject = (typeof SUBJECTS)[number];

/** 任务状态 */
export const TASK_STATUSES = ["未开始", "进行中", "已完成", "已延期"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** 优先级：1 最高 */
export const PRIORITIES = [1, 2, 3] as const;
export type Priority = (typeof PRIORITIES)[number];

/** 考研计划表的一行任务 */
export interface KaoyanTask {
	id: string;
	subject: Subject;
	title: string;
	/** 计划开始 YYYY-MM-DD */
	startDate: string;
	/** 计划结束 YYYY-MM-DD */
	endDate: string;
	/** 计划投入小时数 */
	targetHours: number;
	/** 已投入小时数 */
	doneHours: number;
	status: TaskStatus;
	priority: Priority;
	note?: string;
	createdAt: string;
}

/** 四六级/六级 */
// ── 公考 / 事业编 ────────────────────────────────────────────────────

/** 考试大类 */
export const GONGKAO_TRACKS = ["国考", "省考", "事业单位"] as const;
export type GongkaoTrack = (typeof GONGKAO_TRACKS)[number];

/** 公考科目。国考/省考考行测+申论，事业单位考职测+综应 */
export const GONGKAO_SUBJECTS = ["行测", "申论", "职测", "综应"] as const;
export type GongkaoSubject = (typeof GONGKAO_SUBJECTS)[number];

/** 每个大类对应的科目（用于新增任务时的默认科目） */
export const SUBJECTS_BY_TRACK: Record<GongkaoTrack, GongkaoSubject[]> = {
	国考: ["行测", "申论"],
	省考: ["行测", "申论"],
	事业单位: ["职测", "综应"],
};

/** 省考 / 事业单位可选的省份 */
export const PROVINCES = [
	"北京",
	"上海",
	"天津",
	"重庆",
	"江苏",
	"浙江",
	"广东",
	"山东",
	"湖南",
	"湖北",
	"安徽",
	"四川",
	"福建",
	"河南",
	"河北",
	"山西",
	"陕西",
	"江西",
	"云南",
	"贵州",
	"广西",
	"辽宁",
	"吉林",
	"黑龙江",
	"甘肃",
	"青海",
	"宁夏",
	"新疆",
	"内蒙古",
	"海南",
	"西藏",
] as const;

/** 国考固定全国，试卷分三类 */
export const NATIONAL_PAPER_TYPES = ["副省级", "市地级", "行政执法卷"] as const;

/**
 * 省考的试卷分类。只有部分省份分卷，其余用「通用卷」。
 * 没列到的省份走 OTHER_PROVINCE_PAPER。
 */
export const PROVINCE_PAPER_TYPES: Record<string, readonly string[]> = {
	江苏: ["A类", "B类", "C类"],
	浙江: ["A卷", "B卷"],
	广东: ["县级", "乡镇"],
};

export const OTHER_PROVINCE_PAPER = "通用卷";

/** 事业单位联考按岗位分 A-E 类，另有省内单独命题 */
export const INSTITUTION_PAPER_TYPES = [
	"联考 A类（综合管理）",
	"联考 B类（社会科学专技）",
	"联考 C类（自然科学专技）",
	"联考 D类（中小学教师）",
	"联考 E类（医疗卫生）",
	"省内单独命题",
] as const;

export function getPaperTypes(
	track: GongkaoTrack,
	province?: string,
): readonly string[] {
	if (track === "国考") return NATIONAL_PAPER_TYPES;
	if (track === "事业单位") return INSTITUTION_PAPER_TYPES;
	return PROVINCE_PAPER_TYPES[province ?? ""] ?? [OTHER_PROVINCE_PAPER];
}

/**
 * 一套公考计划。
 *
 * 数据隔离的核心：任务通过 planId 归属到某一套计划，
 * 考研计划 / 国考计划 / A省省考 / B省省考 / 各省事业单位 各自独立，切换不会互相覆盖。
 */
export interface GongkaoPlan {
	id: string;
	/** 展示名，如「2027 国考 · 副省级」 */
	name: string;
	track: GongkaoTrack;
	/** 省考 / 事业单位才有省份；国考为 undefined */
	province?: string;
	paperType: string;
	/** 笔试日期 YYYY-MM-DD */
	examDate: string;
	createdAt: string;
}

/** 公考计划下的一条任务 */
export interface GongkaoTask {
	id: string;
	planId: string;
	subject: GongkaoSubject;
	title: string;
	startDate: string;
	endDate: string;
	targetHours: number;
	doneHours: number;
	status: TaskStatus;
	priority: Priority;
	note?: string;
	createdAt: string;
}

/** 生成一套计划的默认展示名 */
export function buildGongkaoPlanName(input: {
	track: GongkaoTrack;
	province?: string;
	paperType: string;
}) {
	if (input.track === "国考") return `国考 · ${input.paperType}`;
	if (input.track === "省考")
		return `${input.province ?? "省考"}省考 · ${input.paperType}`;
	return `${input.province ?? ""}事业单位 · ${input.paperType}`;
}

export const CET_LEVELS = ["CET4", "CET6"] as const;
export type CetLevel = (typeof CET_LEVELS)[number];

/** 四六级每日打卡记录 */
export interface CetCheckIn {
	id: string;
	/** YYYY-MM-DD，同一天只保留一条 */
	date: string;
	level: CetLevel;
	/** 背单词数 */
	words: number;
	/** 听力分钟数 */
	listening: number;
	/** 阅读篇数 */
	reading: number;
	/** 写作篇数 */
	writing: number;
	/** 翻译篇数 */
	translation: number;
	/** 当日总学习分钟数 */
	minutes: number;
	/** 模考得分（0-710），可选 */
	mockScore?: number;
	note?: string;
}

export const REVIEW_SOURCES = ["考研", "四六级", "课程", "其他"] as const;
export type ReviewSource = (typeof REVIEW_SOURCES)[number];

/** 单次复习反馈 */
export interface ReviewRecord {
	/** YYYY-MM-DD */
	date: string;
	/** 0-5，SM-2 用的自我评分，>=3 视为通过 */
	quality: number;
}

/**
 * 复习条目。调度算法基于 SM-2（SuperMemo 2）：
 * 评分越高 → 间隔越长；评分 <3 → 重置为第 1 天。
 * 这就是艾宾浩斯遗忘曲线的工程实现：在"快要忘记"的节点再过一遍。
 */
export interface ReviewItem {
	id: string;
	title: string;
	subject: string;
	source: ReviewSource;
	createdAt: string;
	lastReviewedAt?: string;
	/** 已完成的复习轮次 */
	stage: number;
	/** SM-2 难度因子，越大越容易 */
	ease: number;
	/** 当前间隔天数 */
	intervalDays: number;
	/** 下次复习日期 YYYY-MM-DD */
	nextReviewAt: string;
	history: ReviewRecord[];
}

/** 全局学习设置 */
export interface StudySettings {
	/** 考研日期 YYYY-MM-DD */
	examDate: string;
	cetLevel: CetLevel;
	/** 四六级考试日期 YYYY-MM-DD */
	cetExamDate: string;
	/** 每日背单词目标 */
	dailyWordGoal: number;
	/** 每日学习分钟目标 */
	dailyMinutesGoal: number;
	/** 每日提醒时间 HH:mm */
	reminderTime: string;
	reminderEnabled: boolean;
	/** 公考 / 事业编的多套计划，各套任务通过 planId 隔离 */
	gongkaoPlans: GongkaoPlan[];
	/** 当前在公考页面选中的计划 id */
	activeGongkaoPlanId?: string;
}

export const DEFAULT_SETTINGS: StudySettings = {
	examDate: nextYearExamDate(),
	cetLevel: "CET4",
	cetExamDate: nextCetExamDate(),
	dailyWordGoal: 80,
	dailyMinutesGoal: 120,
	reminderTime: "21:00",
	reminderEnabled: true,
	gongkaoPlans: [],
};

/**
 * 某个月的第 n 个星期 X（weekday: 0=周日 … 6=周六）。
 * 考试日期都是按「第几个星期几」排的，写死几月几号必然算错。
 */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
	const first = new Date(year, month, 1);
	const offset = (weekday - first.getDay() + 7) % 7;
	return new Date(year, month, 1 + offset + (n - 1) * 7);
}

/** 某个月最后一个星期 X */
function lastWeekday(year: number, month: number, weekday: number) {
	const last = new Date(year, month + 1, 0);
	const back = (last.getDay() - weekday + 7) % 7;
	return new Date(year, month, last.getDate() - back);
}

/** 取还未过去的那一场，过了就顺延到明年 */
function upcoming(...candidates: Date[]) {
	const now = new Date();
	return candidates.find((d) => d > now) ?? candidates[candidates.length - 1];
}

/**
 * 考研初试：12 月的**第三个星期六**。
 * 对照：2026 考研 2025-12-21、2027 考研 2026-12-19，都落在第三个周六。
 * 若今年已过，则取明年。
 */
function nextYearExamDate() {
	const now = new Date();
	const year = now.getFullYear();
	return toDateString(
		upcoming(nthWeekday(year, 11, 6, 3), nthWeekday(year + 1, 11, 6, 3)),
	);
}

/**
 * 四六级笔试：6 月和 12 月的**第二个星期六**。
 * 对照：2026-06-13、2026-12-12。取下一个还没考的场次。
 */
function nextCetExamDate() {
	const now = new Date();
	const year = now.getFullYear();
	return toDateString(
		upcoming(
			nthWeekday(year, 5, 6, 2),
			nthWeekday(year, 11, 6, 2),
			nthWeekday(year + 1, 5, 6, 2),
		),
	);
}

/**
 * 公考笔试日期的常规考期（只是给个合理初值，用户可随时改）：
 * - 国考：11 月最后一个周日（对照 2026 国考 2025-11-30）
 * - 省考：多省联考在 3 月第二个周六（对照 2026 省考 2026-03-14）
 * - 事业单位：上半年联考在 3 月最后一个周六
 */
export function defaultExamDateForTrack(track: GongkaoTrack) {
	const now = new Date();
	const year = now.getFullYear();
	if (track === "国考")
		return toDateString(
			upcoming(lastWeekday(year, 10, 0), lastWeekday(year + 1, 10, 0)),
		);
	if (track === "省考")
		return toDateString(
			upcoming(nthWeekday(year, 2, 6, 2), nthWeekday(year + 1, 2, 6, 2)),
		);
	return toDateString(
		upcoming(lastWeekday(year, 2, 6), nthWeekday(year + 1, 2, 6, 2)),
	);
}

export function toDateString(date: Date) {
	const month = `${date.getMonth() + 1}`.padStart(2, "0");
	const day = `${date.getDate()}`.padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

export function todayString() {
	return toDateString(new Date());
}

/**
 * 生成唯一 id。
 *
 * `crypto.randomUUID()` 只在安全上下文（HTTPS 或 localhost）里存在——
 * 用手机通过局域网 http://192.168.x.x 打开时它是 undefined，会直接抛错。
 * 所以这里必须有降级实现。
 */
export function newId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
		return crypto.randomUUID();
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
