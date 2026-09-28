// 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
// 新增：Electron 主进程（本地静态服务器）
// 修改日期：2026-09-27 ~ 2026-09-28
// 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
const { app, BrowserWindow, Menu, shell } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

/**
 * 学习中心桌面版主进程。
 *
 * 关键点：**不要直接用 file:// 加载页面**。
 * file:// 不是安全上下文，Chromium 会禁用 IndexedDB 和 Service Worker，
 * 而整个学习模块的数据就存在 IndexedDB 里——那样一打开就是空数据。
 *
 * 所以这里起一个只监听 127.0.0.1 的本地静态服务器，再用 http://127.0.0.1:port 加载，
 * 既拿到安全上下文，又不占用真实端口对外暴露。
 */

const isPackaged = app.isPackaged;
const rendererDir = isPackaged
	? path.join(process.resourcesPath, "app.asar", "renderer")
	: path.join(__dirname, "..", "renderer");

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".woff2": "font/woff2",
	".ico": "image/x-icon",
	".webmanifest": "application/manifest+json",
};

/**
 * 固定端口（被占用时顺延）。
 *
 * 这里**绝不能用随机端口**：页面的 origin 就是 http://127.0.0.1:<port>，
 * 而 localStorage / IndexedDB 都是按 origin 隔离的。端口一变，
 * 上次存的打卡记录、复习队列、设置就全部读不到了——表现为每次打开都像全新安装。
 */
const BASE_PORT = 47625;
const MAX_PORT_TRIES = 20;

/** 起一个本地静态服务器，返回实际监听的端口 */
function startServer() {
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const urlPath = decodeURIComponent(req.url.split("?")[0].split("#")[0]);
			let filePath = path.join(rendererDir, urlPath);

			// 目录穿越保护
			if (!filePath.startsWith(rendererDir)) {
				res.writeHead(403).end("Forbidden");
				return;
			}
			if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
				// 哈希路由下其实只有 / 会被请求，这里兜底回退到 index.html
				filePath = path.join(rendererDir, "index.html");
			}
			const ext = path.extname(filePath).toLowerCase();
			res.writeHead(200, {
				"Content-Type": MIME[ext] || "application/octet-stream",
				"Cache-Control": "no-cache",
			});
			fs.createReadStream(filePath).pipe(res);
		});

		server.on("error", (error) => {
			// 端口被占用就试下一个，保证 origin 在绝大多数情况下是稳定的
			if (error.code === "EADDRINUSE" && attempt < BASE_PORT + MAX_PORT_TRIES) {
				attempt += 1;
				server.listen(attempt, "127.0.0.1");
				return;
			}
			reject(error);
		});

		let attempt = BASE_PORT;
		// 只监听回环地址，不对外暴露
		server.listen(attempt, "127.0.0.1", () => {
			resolve({ server, port: server.address().port });
		});
	});
}

function createWindow(url) {
	const win = new BrowserWindow({
		width: 1280,
		height: 860,
		minWidth: 420,
		minHeight: 620,
		title: "学习中心",
		backgroundColor: "#ffffff",
		autoHideMenuBar: true,
		webPreferences: {
			// 渲染层是纯本地页面，不加载任何远程脚本，无需 node 集成
			nodeIntegration: false,
			contextIsolation: true,
		},
	});

	win.loadURL(url);

	// 页面内的外链交给系统浏览器，不要在 Electron 里开
	win.webContents.setWindowOpenHandler(({ url: target }) => {
		shell.openExternal(target);
		return { action: "deny" };
	});

	if (!isPackaged) win.webContents.openDevTools({ mode: "detach" });
	return win;
}

function buildMenu() {
	const template = [
		{
			label: "文件",
			submenu: [
				{
					label: "打开开发者工具",
					accelerator: "F12",
					click: (_item, focusedWindow) => focusedWindow?.webContents.toggleDevTools(),
				},
				{ type: "separator" },
				{ label: "退出", role: "quit" },
			],
		},
		{
			label: "帮助",
			submenu: [
				{
					label: "关于",
					click: () => {
						const { dialog } = require("electron");
						dialog.showMessageBox({
							type: "info",
							title: "学习中心",
							message: "学习中心 v1.0.0",
							detail:
								"考研计划表 · 四六级打卡 · 定期复习提醒 · AI 数据分析\n数据保存在本机，不上传服务器。",
						});
					},
				},
			],
		},
	];
	Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
	if (!fs.existsSync(path.join(rendererDir, "index.html"))) {
		const { dialog } = require("electron");
		dialog.showErrorBox(
			"缺少渲染层文件",
			`没有找到 ${rendererDir}\\index.html。请先执行渲染层构建。`,
		);
		app.quit();
		return;
	}

	const { port } = await startServer();
	buildMenu();
	createWindow(`http://127.0.0.1:${port}/`);

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0)
			createWindow(`http://127.0.0.1:${port}/`);
	});
});

app.on("window-all-closed", () => {
	app.quit();
});
