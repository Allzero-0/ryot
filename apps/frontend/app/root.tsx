/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 修改：挂载 I18nProvider、lang="zh-CN"、中文字体回退
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import "@mantine/core/styles.css";
import "@mantine/code-highlight/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/carousel/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "mantine-datatable/styles.layer.css";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
	ActionIcon,
	Alert,
	ColorSchemeScript,
	Container,
	createTheme,
	Flex,
	Loader,
	MantineProvider,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import {
	data,
	Links,
	type LinksFunction,
	type LoaderFunctionArgs,
	Meta,
	type MetaFunction,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
	useNavigation,
} from "react-router";
import { Toaster } from "~/components/toaster";
import { I18nProvider, useRuntimeTranslation } from "~/lib/i18n";
import { LOGO_IMAGE_URL } from "~/lib/shared/constants";
import { queryClient } from "~/lib/shared/react-query";
import {
	colorSchemeCookie,
	extendResponseHeaders,
	getToast,
} from "~/lib/utilities.server";
import classes from "~/styles/common.module.css";

const theme = createTheme({
	// 中文字体放在 Poppins 之后：英文/数字仍用 Poppins，中文回退到 Noto Sans SC
	fontFamily:
		"Poppins, 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
	components: {
		Alert: Alert.extend({ defaultProps: { p: "xs" } }),
		ActionIcon: ActionIcon.extend({
			defaultProps: { variant: "subtle", color: "gray" },
		}),
		Container: Container.extend({
			defaultProps: { size: "responsive" },
			classNames: (_, { size }) => ({
				root: size === "responsive" ? classes.responsiveContainer : "",
			}),
		}),
	},
	breakpoints: {
		xs: "30em",
		sm: "48em",
		md: "64em",
		lg: "74em",
		xl: "90em",
		"2xl": "120em",
		"3xl": "155em",
		"4xl": "225em",
	},
});

/**
 * DOM 兜底翻译的挂载点。ryot 上游把英文硬编码在各组件里，
 * 这里在不改动原有组件的前提下把已收录的文案替换成中文。
 */
function TranslationRuntime() {
	useRuntimeTranslation();
	return null;
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Ryot · 学习追踪" },
		{
			name: "description",
			content: "自我托管的生活追踪平台：媒体、健身、考研与四六级学习。",
		},
		{
			property: "og:image",
			content: LOGO_IMAGE_URL,
		},
	];
};

export const links: LinksFunction = () => {
	return [
		{
			rel: "icon",
			type: "image/png",
			sizes: "16x16",
			href: "https://raw.githubusercontent.com/IgnisDa/ryot/main/libs/assets/favicon-16x16.png",
		},
		{
			rel: "icon",
			type: "image/png",
			sizes: "32x32",
			href: "https://raw.githubusercontent.com/IgnisDa/ryot/main/libs/assets/favicon-32x32.png",
		},
		{
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Poppins:wght@100;200;300;400;500;600;700;800;900&display=swap",
		},
		{
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
		},
	];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
	const { toast, headers: toastHeaders } = await getToast(request);
	const colorScheme = await colorSchemeCookie.parse(
		request.headers.get("cookie"),
	);
	const headers = new Headers();
	const defaultColorScheme = colorScheme || "light";
	if (toastHeaders) extendResponseHeaders(headers, toastHeaders);
	return data(
		{
			toast,
			defaultColorScheme,
			isDevelopmentMode: process.env.NODE_ENV === "development",
		},
		{ headers },
	);
};

export default function App() {
	const navigation = useNavigation();
	const loaderData = useLoaderData<typeof loader>();
	useRegisterSW({
		onNeedRefresh: () => location.reload(),
	});

	return (
		<html lang="zh-CN">
			<head>
				{loaderData.isDevelopmentMode ? (
					<script src="https://unpkg.com/react-scan/dist/auto.global.js" />
				) : null}
				<meta charSet="utf-8" />
				<meta
					name="viewport"
					content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover"
				/>
				<link rel="manifest" href="/manifest.json" />
				<link rel="apple-touch-icon" href="/icons/maskable_icon_x180.png" />
				<Meta />
				<Links />
				<ColorSchemeScript forceColorScheme={loaderData.defaultColorScheme} />
			</head>
			<body>
				<NuqsAdapter>
					<I18nProvider>
						<TranslationRuntime />
						<MantineProvider
							theme={theme}
							classNamesPrefix="mnt"
							forceColorScheme={loaderData.defaultColorScheme}
						>
						<QueryClientProvider client={queryClient}>
							<ModalsProvider>
								{["loading", "submitting"].includes(navigation.state) ? (
									<Loader
										top={10}
										size="sm"
										right={10}
										pos="fixed"
										color="yellow"
										style={{ zIndex: 10 }}
									/>
								) : null}
								<Toaster toast={loaderData.toast} />
								<Flex style={{ flexGrow: 1 }} mih="100vh">
									<Outlet />
								</Flex>
								<ScrollRestoration />
								<Scripts />
							</ModalsProvider>
							<ReactQueryDevtools buttonPosition="top-right" />
						</QueryClientProvider>
						</MantineProvider>
					</I18nProvider>
				</NuqsAdapter>
			</body>
		</html>
	);
}
