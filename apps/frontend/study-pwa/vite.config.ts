/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：PWA 独立构建配置
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tsconfigPaths from "vite-tsconfig-paths";

const appDir = fileURLToPath(new URL("../app", import.meta.url));

/**
 * 学习中心 PWA 的独立构建。
 *
 * 为什么单独建一份配置，而不是直接改 apps/frontend 的构建：
 * - ryot 主应用是 SSR 形态（react-router.config.ts 里 ssr:true），产物需要 Node 服务；
 * - 学习中心的数据全在浏览器 IndexedDB 里，压根不需要服务端，
 *   打成纯静态 SPA 才能离线运行、随便丢到哪个静态托管上，也才装得进手机。
 *
 * 页面组件直接复用 apps/frontend/app/routes 下的原文件，不复制代码。
 */
// DESKTOP_BUILD=1 时输出到 Electron 工程的 renderer 目录
const isDesktop = process.env.DESKTOP_BUILD === "1";
const outDir = isDesktop
	? fileURLToPath(new URL("../../desktop/renderer", import.meta.url))
	: fileURLToPath(new URL("../../build/study-pwa", import.meta.url));

export default defineConfig({
	root: fileURLToPath(new URL(".", import.meta.url)),
	// 只放用到的图标（默认 <root>/public），不继承主应用的第三方 logo / 音效
	publicDir: fileURLToPath(new URL("./public", import.meta.url)),
	build: {
		outDir,
		// 保持 true：否则每次构建都会把上一轮的 hashed 文件留在原地并一起预缓存，
		// 产物会一轮轮膨胀（实测第二次就 1.4MB → 2.3MB）。
		// 若在带删除保护的环境里构建失败，先手动 `rm -rf` 输出目录再跑即可。
		emptyOutDir: true,
	},
	resolve: {
		alias: [{ find: /^~\//, replacement: `${appDir}/` }],
	},
	plugins: [
		react(),
		tsconfigPaths({ ignoreConfigErrors: true, root: appDir }),
		VitePWA({
			registerType: "autoUpdate",
			// 主应用 public 里已有一份 manifest.json，这里用中文的覆盖它
			manifestFilename: "manifest.json",
			includeAssets: ["icons/*.png"],
			manifest: {
				name: "学习中心 · 考研与四六级",
				short_name: "学习中心",
				description:
					"考研计划表、四六级打卡、定期复习提醒与学习数据分析，数据存在本机，离线可用",
				lang: "zh-CN",
				dir: "ltr",
				// 哈希路由下所有导航都落在根目录，静态服务器无需 SPA 回退
				start_url: "/",
				scope: "/",
				display: "standalone",
				orientation: "portrait",
				theme_color: "#1c7ed6",
				background_color: "#ffffff",
				categories: ["education", "productivity"],
				icons: [
					{
						src: "icons/maskable_icon_x192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "icons/maskable_icon_x512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "any",
					},
					{
						src: "icons/maskable_icon.png",
						sizes: "602x602",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				// 预缓存全部构建产物：装到手机后首次打开就能离线跑
				globPatterns: ["**/*.{js,css,html,json,png,svg,woff2}"],
				navigateFallback: "/index.html",
				cleanupOutdatedCaches: true,
				clientsClaim: true,
				skipWaiting: true,
				runtimeCaching: [
					{
						// 中文字体走 CDN，缓存住避免离线时字体丢失
						urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
						handler: "CacheFirst",
						options: {
							cacheName: "google-fonts",
							expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [0, 200] },
						},
					},
				],
			},
			devOptions: { enabled: false },
		}),
	],
});
