# -*- coding: utf-8 -*-
"""
build-particle-portraits.py — 角色形象粒子点云生成器（2026-08-16）

把 assets/characters/ 下的角色立绘（832x1216 全场景 CG，无透明通道）离线抠出
人物、采样成粒子点云，写入 assets/particles/p_<角色id>.json，供前端
SemanticParticleField 的 portraitId 直接重组为「角色剪影」。

依赖（一次性，本机维护用，不入前端包）：
    pip install rembg numpy pillow        # 自带 onnxruntime 等；本机 PyPI 官方源
                                          # 慢且损坏时用镜像：
                                          # pip install -i https://pypi.tuna.tsinghua.edu.cn/simple ...
    模型 ~/.u2net/u2net.onnx（176MB, md5 60024c5c889badc19c04ad937298a77b）首次
    运行自动从 GitHub 下载；GitHub 直连慢时可经加速镜像手动放置：
    curl -L -C - -o ~/.u2net/u2net.onnx "https://ghfast.top/https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"

用法：
    python scripts/maintenance/build-particle-portraits.py            # 全量
    python scripts/maintenance/build-particle-portraits.py rem_rezero # 指定角色

产物格式（见 src/utils/particlePortrait.ts 的 PortraitCloud）：
    { "id": "...", "aspect": <bbox宽/高>, "palette": ["#rrggbb", ...],
      "grid": { "w": int, "h": int, "cells": "行拼接的字符画" } }
    cells 每字符一个网格：'.'=背景（无人物），'0'..'7'=调色板序号。
    前端按场域实际尺寸重建等距点阵（明日方舟官网式均匀点阵 + 半调网点），
    点距恒定、明暗靠网点大小/颜色表达——加权采样会疏密不均产生空洞，故废弃。

管线：
    rembg(alpha_matting) 抠人物 → 140px 宽覆盖网格 + k-means 8 主色量化 →
    行拼接字符画输出。
"""
import json
import sys
from pathlib import Path

from PIL import Image
import numpy as np
from rembg import remove, new_session

ROOT = Path(__file__).resolve().parents[2]
CHAR_DIR = ROOT / "assets" / "characters"
OUT_DIR = ROOT / "assets" / "particles"
# 覆盖网格源宽：前端点阵通常 ≤ ~90×220，140px 源网格足够无混叠采样
SOURCE_WIDTH = 140
PALETTE_SIZE = 8
ALPHA_OPAQUE = 60

# 工作室角色立绘文件名与角色 id 的对应（热门角色固定 popular-<id>.png）
STUDIO_PORTRAITS = {"nene": "nene-official.webp", "natsume": "natsume-official.webp"}


def kmeans_palette(rgb: np.ndarray, mask: np.ndarray, k: int, seed: str) -> list[tuple[int, int, int]]:
    """对人物像素做 k-means（确定性初始化），返回按占比排序的 k 个主色——
    粒子按角色真实配色成像（蓝发/黑白女仆装等按色块分布）。"""
    pixels = rgb[mask].astype(float)
    rng = np.random.default_rng(sum(ord(c) for c in seed) % (2 ** 32))
    centers = pixels[rng.choice(len(pixels), size=k, replace=False)]
    assign = None
    for _ in range(10):
        dists = ((pixels[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2)
        assign = dists.argmin(axis=1)
        for i in range(k):
            sel = pixels[assign == i]
            if len(sel):
                centers[i] = sel.mean(axis=0)
    counts = [(assign == i).sum() for i in range(k)]
    ranked = sorted(range(k), key=lambda i: -counts[i])
    return [tuple(int(round(v)) for v in centers[i]) for i in ranked]


def grid_from_image(image: Image.Image) -> tuple[str, int, int, float, list[str]] | None:
    """返回 (cells 字符画, 网格宽, 网格高, bbox 宽高比, 调色板)；抠不出人物返回 None。

    覆盖网格（均匀、无加权）：'.'=背景，'0'..'7'=最近调色板。前端在运行时按
    场域实际尺寸对该网格做最近邻采样重建等距点阵——点距均匀才不会出空洞。"""
    cut = remove(image.convert("RGBA"), session=SESSION, alpha_matting=True)
    w0, h0 = cut.size
    scale = SOURCE_WIDTH / w0
    small = cut.resize((SOURCE_WIDTH, max(1, round(h0 * scale))), Image.LANCZOS)
    arr = np.array(small)
    alpha = arr[..., 3]
    mask = alpha > ALPHA_OPAQUE
    if mask.sum() < 220:  # ~2% 以下认为抠图失败
        return None
    rgb = arr[..., :3]

    # 主色：k-means 提取人物真实配色（蓝发/黑白女仆装等按色块成像）
    palette_rgb = kmeans_palette(rgb, mask, PALETTE_SIZE, char_id_seed(image))
    # 每像素最近的调色板色
    flat = rgb[mask].astype(float)
    dists = ((flat[:, None, :] - np.array(palette_rgb, dtype=float)[None, :, :]) ** 2).sum(axis=2)
    nearest = dists.argmin(axis=1)
    color_index = np.full(mask.shape, -1, dtype=int)
    color_index[mask] = nearest

    # 包围盒（留 1px 余量）
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    if y1 - y0 < 8 or x1 - x0 < 8:
        return None
    y1 = min(mask.shape[0] - 1, y1 + 1)
    x1 = min(mask.shape[1] - 1, x1 + 1)

    rows: list[str] = []
    for y in range(y0, y1 + 1):
        rows.append("".join(
            "." if color_index[y, x] < 0 else str(color_index[y, x])
            for x in range(x0, x1 + 1)
        ))
    aspect = (x1 - x0) / max(1, y1 - y0)
    palette = ["#%02x%02x%02x" % c for c in palette_rgb]
    return "".join(rows), (x1 - x0 + 1), (y1 - y0 + 1), aspect, palette


def char_id_seed(image: Image.Image) -> str:
    return getattr(image, "filename", "") or "seed"


def build_one(char_id: str, source: Path) -> bool:
    image = Image.open(source)
    result = grid_from_image(image)
    if result is None:
        print(f"[skip] {char_id}: 抠图失败或人物过小（{source.name}）")
        return False
    cells, grid_w, grid_h, aspect, palette = result
    if cells.count(".") == len(cells) or len(cells) - cells.count(".") < 90:
        print(f"[skip] {char_id}: 有效网格不足")
        return False

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"p_{char_id}.json"
    payload = {
        "id": char_id,
        "aspect": round(aspect, 4),
        "palette": palette,
        "grid": {"w": int(grid_w), "h": int(grid_h), "cells": cells},
    }
    out.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    filled = len(cells) - cells.count(".")
    print(f"[ok] {char_id}: 网格 {grid_w}x{grid_h}（人物 {filled} 格）{len(palette)} 色 → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")
    return True


def main() -> None:
    only = set(sys.argv[1:])
    targets: dict[str, Path] = {}
    for path in sorted(CHAR_DIR.glob("popular-*.png")):
        char_id = path.stem.removeprefix("popular-")
        targets[char_id] = path
    for char_id, name in STUDIO_PORTRAITS.items():
        path = CHAR_DIR / name
        if path.exists():
            targets[char_id] = path
    if only:
        targets = {k: v for k, v in targets.items() if k in only}
    if not targets:
        print("没有可处理的立绘")
        return
    ok = 0
    for char_id, source in targets.items():
        try:
            ok += build_one(char_id, source)
        except Exception as error:  # 单张失败不阻断批量
            print(f"[fail] {char_id}: {error}")
    print(f"完成 {ok}/{len(targets)}")


SESSION = new_session("u2net")

if __name__ == "__main__":
    main()
