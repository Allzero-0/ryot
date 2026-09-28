// 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
// 新增：侧边栏与路由表一致性检查
// 修改日期：2026-09-27 ~ 2026-09-28
// 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
/**
 * 路由一致性检查。
 *
 * 桌面/PWA 应用的路由是 `main.tsx` 里手写的，而侧边栏菜单在 `app/routes/study.tsx`。
 * 新增页面时两边都要加——漏了 main.tsx 就会落到 "*" 兜底，表现为「点了菜单跳回总览」。
 * 这个脚本把两侧的路由对比一遍，构建前跑一次就能提前发现。
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const navFile = resolve(here, "../app/routes/study.tsx");
const mainFile = resolve(here, "./main.tsx");

const navSource = readFileSync(navFile, "utf8");
const mainSource = readFileSync(mainFile, "utf8");

// 侧边栏：{ label: "...", to: "/study/xxx" }
const navPaths = [...navSource.matchAll(/to:\s*"\/study(?:\/([a-z-]+))?"/g)].map(
	(m) => m[1] ?? "",
);
// 路由表：<Route path="xxx" .../>，以及 index
const routePaths = [
	...mainSource.matchAll(/<Route\s+path="([a-z-]+)"/g),
].map((m) => m[1]);
const hasIndex = /<Route\s+index\b/.test(mainSource);

let failures = 0;
console.log("\n侧边栏菜单指向的路径:", navPaths.map((p) => `/study/${p}`).join(", "));
console.log("main.tsx 注册的路由:", routePaths.join(", "), hasIndex ? "(含 index)" : "");

if (navPaths.includes("") && !hasIndex) {
	failures += 1;
	console.log("✗ 侧边栏有 /study，但 main.tsx 缺 <Route index>");
}

for (const path of navPaths) {
	if (path === "") continue;
	if (!routePaths.includes(path)) {
		failures += 1;
		console.log(`✗ 侧边栏有 /study/${path}，但 main.tsx 没有注册该路由`);
	}
}

for (const path of routePaths) {
	if (path === "study" || path === "*") continue;
	if (!navPaths.includes(path))
		console.log(`⚠ main.tsx 有 /study/${path}，但侧边栏没有入口（可能是刻意隐藏）`);
}

console.log(
	failures === 0 ? "\n路由一致 ✓\n" : `\n${failures} 处不一致 ✗\n`,
);
process.exit(failures === 0 ? 0 : 1);
