/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：PWA 入口与手写路由表
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/notifications/styles.css";
import { createTheme, MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
	HashRouter,
	Navigate,
	Route,
	Routes,
} from "react-router";
import { registerSW } from "virtual:pwa-register";
import { I18nProvider } from "~/lib/i18n";
import { useRuntimeTranslation } from "~/lib/i18n";
import StudyOverviewPage from "~/routes/study._index";
import StudyAnalyticsPage from "~/routes/study.analytics";
import StudyCetPage from "~/routes/study.cet";
import StudyGongkaoPage from "~/routes/study.gongkao";
import StudyPlanPage from "~/routes/study.plan";
import StudyReviewPage from "~/routes/study.review";
import StudyLayout from "~/routes/study";

const theme = createTheme({
	fontFamily:
		"Poppins, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
});

/** 挂载 DOM 兜底翻译（针对 ryot 上游遗留的硬编码英文） */
function TranslationRuntime() {
	useRuntimeTranslation();
	return null;
}

function App() {
	return (
		<MantineProvider theme={theme} classNamesPrefix="mnt">
			<ModalsProvider>
				<I18nProvider>
					<TranslationRuntime />
					{/*
						用 HashRouter 而不是 BrowserRouter：静态托管（含发布用的内置服务器）
						不一定做 SPA 回退，直接访问 /study 会 404——而 PWA 从桌面图标启动时
						打开的正是这个地址。哈希路由下所有请求都落在 /，任何静态服务器都能跑。
					*/}
					{/*
						这里的路由表是**手写**的（主应用 apps/frontend 用的是 fs-routes 自动发现）。
						新增页面时两处都要加：这里 + routes/study.tsx 的侧边栏，
						漏了这里就会落到下面的 "*" 兜底，表现为点了菜单跳回总览。
					*/}
					<HashRouter>
						<Routes>
							<Route path="/" element={<Navigate to="/study" replace />} />
							<Route path="/study" element={<StudyLayout />}>
								<Route index element={<StudyOverviewPage />} />
								<Route path="plan" element={<StudyPlanPage />} />
								<Route path="gongkao" element={<StudyGongkaoPage />} />
								<Route path="cet" element={<StudyCetPage />} />
								<Route path="review" element={<StudyReviewPage />} />
								<Route path="analytics" element={<StudyAnalyticsPage />} />
							</Route>
							<Route path="*" element={<Navigate to="/study" replace />} />
						</Routes>
					</HashRouter>
				</I18nProvider>
			</ModalsProvider>
		</MantineProvider>
	);
}

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");
createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

// 有新版本时自动更新并刷新
registerSW({ immediate: true });
