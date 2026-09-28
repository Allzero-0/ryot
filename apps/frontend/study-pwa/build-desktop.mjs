// 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
// 新增：桌面端渲染层构建脚本
// 修改日期：2026-09-27 ~ 2026-09-28
// 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
/**
 * 桌面端渲染层构建。
 *
 * 不写成 `DESKTOP_BUILD=1 vite build`：那种环境变量前缀在 Windows 的
 * CMD / PowerShell 里不生效，只在 bash 下能用。这里直接在 Node 里设好再调
 * vite 的 JS API，跨平台都一致。
 */
process.env.DESKTOP_BUILD = "1";

const { fileURLToPath } = await import("node:url");
const { build } = await import("vite");

await build({
	configFile: fileURLToPath(new URL("./vite.config.ts", import.meta.url)),
});

console.log("\n渲染层已输出到 apps/desktop/renderer");
