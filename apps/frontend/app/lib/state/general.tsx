/**
 * 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
 * 修改：侧边栏展开状态增加 study 字段
 * 修改日期：2026-09-27 ~ 2026-09-28
 * 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
 */
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

type OpenedSidebarLinks = {
	media: boolean;
	fitness: boolean;
	settings: boolean;
	collection: boolean;
	/** 学习中心（本项目新增模块） */
	study: boolean;
};

export const defaultSidebarLinksState: OpenedSidebarLinks = {
	media: false,
	fitness: false,
	settings: false,
	collection: false,
	study: true,
};

const openedSidebarLinksAtom = atomWithStorage<OpenedSidebarLinks>(
	"OpenedSidebarLinks",
	defaultSidebarLinksState,
);

export const useOpenedSidebarLinks = () => {
	const [openedSidebarLinks, setOpenedSidebarLinks] = useAtom(
		openedSidebarLinksAtom,
	);
	return { openedSidebarLinks, setOpenedSidebarLinks };
};

type FullscreenImageData = { src: string };

const fullscreenImageAtom = atom<FullscreenImageData | null>(null);

export const useFullscreenImage = () => {
	const [fullscreenImage, setFullscreenImage] = useAtom(fullscreenImageAtom);
	return { fullscreenImage, setFullscreenImage };
};
