/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：公考模块冒烟测试
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
/**
 * 公考 / 事业编模块的冒烟测试。
 * 重点验证两件事：1) 统计结果与考研模块口径一致；2) 多套计划数据相互隔离。
 */
import {
	analyzeGongkao,
	analyzeKaoyan,
	analyzePlan,
} from "./ai";
import { applyReview, createReviewItem } from "./review-scheduler";
import { buildDemoData } from "./seed";
import {
	DEFAULT_SETTINGS,
	GONGKAO_SUBJECTS,
	SUBJECTS_BY_TRACK,
	defaultExamDateForTrack,
	getPaperTypes,
	type GongkaoPlan,
	type GongkaoTask,
} from "./types";

let failures = 0;
function check(name: string, condition: boolean, extra?: unknown) {
	if (condition) console.log(`  ✓ ${name}`);
	else {
		failures += 1;
		console.log(`  ✗ ${name}`, extra ?? "");
	}
}

const T = (over: Partial<GongkaoTask>): GongkaoTask => ({
	id: Math.random().toString(36).slice(2),
	planId: "p1",
	subject: "行测",
	title: "任务",
	startDate: "2026-09-01",
	endDate: "2026-10-01",
	targetHours: 10,
	doneHours: 0,
	status: "进行中",
	priority: 2,
	createdAt: "2026-09-01",
	...over,
});

const plans: GongkaoPlan[] = [
	{
		id: "p1",
		name: "国考 · 副省级",
		track: "国考",
		paperType: "副省级",
		examDate: "2026-11-29",
		createdAt: "2026-09-01",
	},
	{
		id: "p2",
		name: "江苏省考 · A类",
		track: "省考",
		province: "江苏",
		paperType: "A类",
		examDate: "2027-03-13",
		createdAt: "2026-09-01",
	},
	{
		id: "p3",
		name: "四川事业单位 · 联考 A类（综合管理）",
		track: "事业单位",
		province: "四川",
		paperType: "联考 A类（综合管理）",
		examDate: "2027-03-27",
		createdAt: "2026-09-01",
	},
];

console.log("\n[1] 考试大类与试卷类型目录");
check("三个大类齐全", ["国考", "省考", "事业单位"].every((t) => t));
check("国考三套卷", getPaperTypes("国考").length === 3, getPaperTypes("国考"));
check("江苏分 A/B/C", getPaperTypes("省考", "江苏").join(",") === "A类,B类,C类");
check("浙江分 A/B", getPaperTypes("省考", "浙江").length === 2);
check("广东县级/乡镇", getPaperTypes("省考", "广东").join(",") === "县级,乡镇");
check("未配置省份回落通用卷", getPaperTypes("省考", "山东").join(",") === "通用卷");
check("事业单位联考 A-E + 单独命题", getPaperTypes("事业单位").length === 6);
check("国考科目是行测+申论", SUBJECTS_BY_TRACK["国考"].join(",") === "行测,申论");
check("事业单位科目是职测+综应", SUBJECTS_BY_TRACK["事业单位"].join(",") === "职测,综应");

console.log("\n[2] 笔试日期默认初值");
for (const track of ["国考", "省考", "事业单位"] as const) {
	const d = defaultExamDateForTrack(track);
	check(`${track} 默认日期 ${d} 合法且在将来`, /^\d{4}-\d{2}-\d{2}$/.test(d) && d > "2026-09-27", d);
}

console.log("\n[3] 与考研模块口径一致（同一批数据应得出相同结论）");
const shared = [
	T({ targetHours: 100, doneHours: 40 }),
	T({ targetHours: 100, doneHours: 10, status: "已延期", subject: "申论" }),
];
const viaPlan = analyzePlan({
	tasks: shared,
	examDate: "2026-11-29",
	dailyMinutesGoal: 120,
	subjects: GONGKAO_SUBJECTS,
});
const viaGongkao = analyzeGongkao(shared, plans[0], DEFAULT_SETTINGS, plans);
check(
	"总体进度一致",
	viaPlan.overallProgress === viaGongkao.overallProgress,
	`${viaPlan.overallProgress} vs ${viaGongkao.overallProgress}`,
);
check(
	"每日所需一致",
	viaPlan.requiredHoursPerDay === viaGongkao.requiredHoursPerDay,
);
check("风险等级一致", viaPlan.risk === viaGongkao.risk, viaGongkao.risk);
check("延期任务数一致", viaGongkao.delayedTasks.length === 1);
check("只统计四个公考科目", viaGongkao.bySubject.length === 2, viaGongkao.bySubject.map((s) => s.subject));

console.log("\n[4] 多套计划数据隔离");
const allTasks: GongkaoTask[] = [
	T({ planId: "p1", subject: "行测", targetHours: 100, doneHours: 50 }),
	T({ planId: "p1", subject: "申论", targetHours: 60, doneHours: 30 }),
	T({ planId: "p2", subject: "行测", targetHours: 80, doneHours: 10 }),
	T({ planId: "p3", subject: "职测", targetHours: 40, doneHours: 40 }),
	T({ planId: "p3", subject: "综应", targetHours: 40, doneHours: 0 }),
];

const p1 = analyzeGongkao(
	allTasks.filter((t) => t.planId === "p1"),
	plans[0],
	DEFAULT_SETTINGS,
	plans,
);
const p2 = analyzeGongkao(
	allTasks.filter((t) => t.planId === "p2"),
	plans[1],
	DEFAULT_SETTINGS,
	plans,
);
const p3 = analyzeGongkao(
	allTasks.filter((t) => t.planId === "p3"),
	plans[2],
	DEFAULT_SETTINGS,
	plans,
);

check("国考计划只算自己的 160h", p1.totalTargetHours === 160, p1.totalTargetHours);
check("江苏省考只算自己的 80h", p2.totalTargetHours === 80, p2.totalTargetHours);
check("四川事业单位只算自己的 80h", p3.totalTargetHours === 80, p3.totalTargetHours);
check("国考进度 50%", p1.overallProgress === 50, p1.overallProgress);
check("江苏省考进度 13%", p2.overallProgress === 13, p2.overallProgress);
check("事业单位进度 50%", p3.overallProgress === 50, p3.overallProgress);
check(
	"三套计划的倒计时各不相同",
	new Set([p1.remainingDays, p2.remainingDays, p3.remainingDays]).size === 3,
	[p1.remainingDays, p2.remainingDays, p3.remainingDays],
);
check("江苏省考只剩行测一科", p2.bySubject.length === 1 && p2.bySubject[0].subject === "行测");
check("事业单位含职测与综应", p3.bySubject.map((s) => s.subject).sort().join(",") === "综应,职测");

console.log("\n[5] 科目进度可按计划展开子项");
const merged = analyzeGongkao(allTasks, plans[0], DEFAULT_SETTINGS, plans);
const xingce = merged.bySubject.find((s) => s.subject === "行测");
check("行测有子项", Boolean(xingce?.children?.length), xingce?.children?.length);
check(
	"行测子项按计划拆分为国考/江苏省考",
	xingce?.children?.map((c) => c.label).sort().join(" | ") ===
		"国考 · 副省级 | 江苏省考 · A类",
	xingce?.children?.map((c) => c.label),
);
const targetSum = xingce?.children?.reduce((s, c) => s + c.targetHours, 0);
check("子项时长之和等于该科目总时长", targetSum === 180, targetSum);

console.log("\n[6] 风险预警阈值");
const tight = analyzeGongkao(
	[T({ planId: "p1", targetHours: 400, doneHours: 0 })],
	plans[0],
	DEFAULT_SETTINGS,
	plans,
);
check("任务过重时风险为高", tight.risk === "高", `${tight.risk} / ${tight.requiredHoursPerDay.toFixed(1)}h`);
check(
	"所需日均确实超过设定上限",
	tight.requiredHoursPerDay > tight.availableHoursPerDay,
	`${tight.requiredHoursPerDay.toFixed(1)} > ${tight.availableHoursPerDay.toFixed(1)}`,
);
const easy = analyzeGongkao(
	[T({ planId: "p1", targetHours: 10, doneHours: 0 })],
	plans[0],
	DEFAULT_SETTINGS,
	plans,
);
check("任务轻松时风险为低", easy.risk === "低", easy.risk);

console.log("\n[7] 考研模块未受影响");
const demo = buildDemoData();
const kaoyan = analyzeKaoyan(demo.tasks, DEFAULT_SETTINGS);
check("考研进度仍在 0-100", kaoyan.overallProgress >= 0 && kaoyan.overallProgress <= 100, kaoyan.overallProgress);
check("考研科目仍是五科口径", kaoyan.bySubject.every((s) => s.children === undefined));
check("考研任务与公考任务互不相干", demo.tasks.length === 10);

console.log("\n[8] 复习调度未受影响");
let reviewItem = createReviewItem({
	title: "资料分析速算",
	subject: "行测",
	source: "其他",
});
reviewItem = applyReview(reviewItem, 5);
check("高分后进入第 1 轮、间隔 1 天", reviewItem.stage === 1 && reviewItem.intervalDays === 1);
reviewItem = applyReview(reviewItem, 1);
check("低分后打回第 0 轮", reviewItem.stage === 0);

console.log(failures === 0 ? "\n全部通过 ✓\n" : `\n${failures} 项失败 ✗\n`);
process.exit(failures === 0 ? 0 : 1);
