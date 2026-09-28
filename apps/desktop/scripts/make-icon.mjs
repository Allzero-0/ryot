// 本文件修改自 ryot（https://github.com/IgnisDa/ryot）。
// 新增：由 PNG 生成 .ico
// 修改日期：2026-09-27 ~ 2026-09-28
// 授权：GNU General Public License v3.0（见仓库根目录 LICENSE），与上游 ryot 保持一致。
/**
 * 由 PNG 生成 Windows 安装包需要的 .ico。
 *
 * ICO 容器允许直接内嵌 PNG 数据（Vista 起支持），所以不需要任何图像处理库，
 * 拼一个 6 字节头 + 16 字节目录项 + PNG 原始字节即可。
 *
 * 输入默认取前端 public 里的 512×512 图标，输出 apps/desktop/build/icon.ico。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = fileURLToPath(
	new URL("../../frontend/public/icons/maskable_icon_x512.png", import.meta.url),
);
const output = `${dirname(here)}/build/icon.ico`;

if (!existsSync(source)) {
	console.error(`找不到源图标：${source}`);
	process.exit(1);
}

function parsePngSize(buffer) {
	// PNG: 8 字节签名 + 4 字节长度 + 4 字节 "IHDR"，随后是宽、高各 4 字节大端
	return {
		width: buffer.readUInt32BE(16),
		height: buffer.readUInt32BE(20),
	};
}

const png = readFileSync(source);
const { width, height } = parsePngSize(png);
if (width !== height) {
	console.error(`图标必须是正方形，当前是 ${width}×${height}`);
	process.exit(1);
}

const count = 1;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: 1 = icon
header.writeUInt16LE(count, 4);

const entry = Buffer.alloc(16);
// ICO 的宽高字段是 1 字节，256 用 0 表示
entry.writeUInt8(width >= 256 ? 0 : width, 0);
entry.writeUInt8(height >= 256 ? 0 : height, 1);
entry.writeUInt8(0, 2); // 调色板色数
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // 色平面
entry.writeUInt16LE(32, 6); // 位深
entry.writeUInt32LE(png.length, 8); // 数据长度
entry.writeUInt32LE(6 + 16, 12); // 数据偏移

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, Buffer.concat([header, entry, png]));

console.log(`已生成 ${output}（${width}×${height}，${png.length} 字节 PNG 内嵌）`);
