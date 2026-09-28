/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 新增：中文 i18n 层与 DOM 兜底翻译
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
} from "react";
import { zhCN } from "./locales/zh-CN";

/**
 * 界面语言固定为简体中文。
 *
 * 之前做过中/英切换，实际不可用：ryot 上游把英文硬编码在 152 个组件里，
 * 切到英文只能让 `t()` 失效，而 DOM 兜底翻译已经替换过的中文没法回滚，
 * 界面就变成中英混排。与其留个点了没反应的开关，不如只保留简体中文。
 */
export const LOCALE = "zh-CN" as const;
export type Locale = typeof LOCALE;

const DICTIONARY = zhCN;

type I18nContextValue = {
	locale: Locale;
	/** 是否启用 DOM 兜底翻译（针对尚未改造的硬编码英文） */
	runtimeTranslation: boolean;
	t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
	locale: LOCALE,
	runtimeTranslation: true,
	t: (key) => DICTIONARY[key] ?? key,
});

/**
 * 翻译单个词条。查不到时**原样返回 key**——这样即使某个词没进词典，
 * 界面也只会保持英文而不会变成空白或 undefined。
 */
export const translate = (
	key: string,
	vars?: Record<string, string | number>,
) => {
	const raw = DICTIONARY[key] ?? key;
	if (!vars) return raw;
	return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
};

export function I18nProvider({ children }: { children: ReactNode }) {
	const value = useMemo<I18nContextValue>(
		() => ({
			locale: LOCALE,
			runtimeTranslation: true,
			t: (key, vars) => translate(key, vars),
		}),
		[],
	);
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useTranslation = () => useContext(I18nContext);

// ─────────────────────────────────────────────────────────────────────
// 运行时兜底翻译
//
// ryot 上游把英文硬编码在 152 个组件里，一次性全部替换成 t() 不现实。
// 这里提供一个 DOM 层的补丁：对所有文本节点做**全词精确匹配**替换。
// 因为只认完整字符串，像《进击的巨人》这种媒体标题不会被误伤。
//
// 这是过渡方案，改造完成的组件应改用 t() 并在元素上加 data-no-i18n。
// ─────────────────────────────────────────────────────────────────────

const SKIP_TAGS = new Set([
	"SCRIPT",
	"STYLE",
	"NOSCRIPT",
	"CODE",
	"PRE",
	"TEXTAREA",
	"SVG",
	"MATH",
	"CANVAS",
]);

/** 这些属性里也藏了大量界面文案（尤其 placeholder） */
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

const lastTranslatedText = new WeakMap<Text, string>();
const lastTranslatedAttr = new WeakMap<Element, Record<string, string>>();

const shouldSkipElement = (element: Element) =>
	element.closest("[data-no-i18n]") !== null;

export function useRuntimeTranslation() {
	useEffect(() => {
		if (typeof document === "undefined" || typeof MutationObserver === "undefined")
			return;

		const dictionary = DICTIONARY;

		const translateTextNode = (node: Text) => {
			const raw = node.nodeValue;
			if (!raw) return;
			if (lastTranslatedText.get(node) === raw) return;
			const trimmed = raw.trim();
			if (!trimmed) return;
			const translated = dictionary[trimmed];
			if (!translated) return;
			const parent = node.parentElement;
			if (!parent || SKIP_TAGS.has(parent.tagName)) return;
			if (shouldSkipElement(parent)) return;
			const next = raw.replace(trimmed, translated);
			lastTranslatedText.set(node, next);
			node.nodeValue = next;
		};

		const translateElementAttributes = (element: Element) => {
			if (!(element instanceof HTMLElement)) return;
			if (SKIP_TAGS.has(element.tagName)) return;
			if (shouldSkipElement(element)) return;
			const cache = lastTranslatedAttr.get(element) ?? {};
			let dirty = false;
			for (const attribute of TRANSLATABLE_ATTRIBUTES) {
				const raw = element.getAttribute(attribute);
				if (!raw) continue;
				if (cache[attribute] === raw) continue;
				const translated = dictionary[raw.trim()];
				if (!translated) {
					cache[attribute] = raw;
					continue;
				}
				element.setAttribute(attribute, raw.replace(raw.trim(), translated));
				cache[attribute] = element.getAttribute(attribute) ?? raw;
				dirty = true;
			}
			if (dirty) lastTranslatedAttr.set(element, cache);
		};

		const walk = (root: Node) => {
			if (root.nodeType === Node.TEXT_NODE) {
				translateTextNode(root as Text);
				return;
			}
			if (root.nodeType !== Node.ELEMENT_NODE) return;
			const element = root as Element;
			translateElementAttributes(element);
			if (SKIP_TAGS.has(element.tagName)) return;
			const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
			let current = walker.nextNode();
			while (current) {
				translateTextNode(current as Text);
				current = walker.nextNode();
			}
		};

		let frame = 0;
		const pending = new Set<Node>();
		const flush = () => {
			frame = 0;
			for (const node of pending) {
				try {
					walk(node);
				} catch {
					// 单个节点失败不影响其余部分
				}
			}
			pending.clear();
		};

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "characterData") {
					if (mutation.target.isConnected) pending.add(mutation.target);
				} else {
					for (const node of mutation.addedNodes) {
						if (node.isConnected) pending.add(node);
					}
				}
			}
			if (!frame) frame = requestAnimationFrame(flush);
		});

		walk(document.body);
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			characterData: true,
		});

		return () => {
			observer.disconnect();
			if (frame) cancelAnimationFrame(frame);
			pending.clear();
		};
	}, []);
}
