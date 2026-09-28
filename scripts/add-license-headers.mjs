/**
 * 给改动过的文件批量加上 GPL 修改头（GPL 第 5 条 a 款的推荐做法）。
 *
 * 用法：node scripts/add-license-headers.mjs
 * 可重复执行：已经带「修改自 ryot」标记的文件会被跳过。
 * JSON 文件不能写注释，在 MODIFICATIONS.md 里统一说明。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MARK = "修改自 ryot";
const DATE = "2026-09-27 ~ 2026-09-28";

/** 相对路径 → [新增|修改, 说明] */
const FILES = {
	// ── 新增：学习模块 ──
	"apps/frontend/app/lib/i18n/index.tsx": ["新增", "中文 i18n 层与 DOM 兜底翻译"],
	"apps/frontend/app/lib/i18n/locales/zh-CN.ts": ["新增", "中文词条表"],
	"apps/frontend/app/lib/study/types.ts": ["新增", "学习模块数据类型与考试试卷目录"],
	"apps/frontend/app/lib/study/storage.ts": ["新增", "IndexedDB 存储封装"],
	"apps/frontend/app/lib/study/store.tsx": ["新增", "学习模块全局状态与增删改"],
	"apps/frontend/app/lib/study/review-scheduler.ts": ["新增", "SM-2 间隔重复复习调度"],
	"apps/frontend/app/lib/study/ai.ts": ["新增", "本地规则分析引擎（通用 analyzePlan）"],
	"apps/frontend/app/lib/study/seed.ts": ["新增", "示例数据生成"],
	"apps/frontend/app/lib/study/reminder.ts": ["新增", "复习提醒（Notification API）"],
	"apps/frontend/app/lib/study/smoke.ts": ["新增", "考研模块冒烟测试"],
	"apps/frontend/app/lib/study/smoke-gongkao.ts": ["新增", "公考模块冒烟测试"],
	"apps/frontend/app/components/study/plan-shared.tsx": [
		"新增",
		"考研与公考共用的 UI 组件（卡片/进度/表格/弹窗）",
	],
	"apps/frontend/app/routes/study.tsx": ["新增", "学习中心外壳布局与侧边导航"],
	"apps/frontend/app/routes/study._index.tsx": ["新增", "学习总览页"],
	"apps/frontend/app/routes/study.plan.tsx": ["新增", "考研计划表页"],
	"apps/frontend/app/routes/study.gongkao.tsx": ["新增", "公考事业编计划表页"],
	"apps/frontend/app/routes/study.cet.tsx": ["新增", "四六级打卡页"],
	"apps/frontend/app/routes/study.review.tsx": ["新增", "定期复习提醒页"],
	"apps/frontend/app/routes/study.analytics.tsx": ["新增", "AI 数据分析页"],

	// ── 新增：PWA 与桌面端 ──
	"apps/frontend/study-pwa/main.tsx": ["新增", "PWA 入口与手写路由表"],
	"apps/frontend/study-pwa/vite.config.ts": ["新增", "PWA 独立构建配置"],
	"apps/frontend/study-pwa/build-desktop.mjs": ["新增", "桌面端渲染层构建脚本"],
	"apps/frontend/study-pwa/check-routes.mjs": ["新增", "侧边栏与路由表一致性检查"],
	"apps/desktop/electron/main.js": ["新增", "Electron 主进程（本地静态服务器）"],
	"apps/desktop/scripts/make-icon.mjs": ["新增", "由 PNG 生成 .ico"],

	// ── 修改：接入学习模块 ──
	"apps/frontend/app/root.tsx": [
		"修改",
		'挂载 I18nProvider、lang="zh-CN"、中文字体回退',
	],
	"apps/frontend/app/routes/_dashboard.tsx": ["修改", "侧边栏加入「学习中心」入口"],
	"apps/frontend/app/components/routes/dashboard/navigation/navigation-config.ts": [
		"修改",
		"侧边栏「学习中心」子菜单配置",
	],
	"apps/frontend/app/lib/state/general.tsx": [
		"修改",
		"侧边栏展开状态增加 study 字段",
	],
};

function buildHeader(kind, desc, style) {
	const lines = [
		`${kind}：${desc}`,
		`修改日期：${DATE}`,
		"授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。",
	];
	if (style === "block")
		return [
			"/**",
			" * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。",
			...lines.map((l) => ` * ${l}`),
			" */",
			"",
		].join("\n");
	return [
		"// 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。",
		...lines.map((l) => `// ${l}`),
		"",
	].join("\n");
}

let added = 0;
let skipped = 0;
let missing = 0;

for (const [rel, [kind, desc]] of Object.entries(FILES)) {
	const abs = join(root, rel);
	if (!existsSync(abs)) {
		console.log(`✗ 文件不存在: ${rel}`);
		missing += 1;
		continue;
	}
	const source = readFileSync(abs, "utf8");
	if (source.includes(MARK)) {
		skipped += 1;
		continue;
	}
	const style = rel.endsWith(".ts") || rel.endsWith(".tsx") ? "block" : "line";
	writeFileSync(abs, buildHeader(kind, desc, style) + source, "utf8");
	added += 1;
	console.log(`✓ ${kind}头: ${rel}`);
}

console.log(`\n新增头 ${added} 个，已存在跳过 ${skipped} 个，缺失 ${missing} 个`);
process.exit(missing > 0 ? 1 : 0);
