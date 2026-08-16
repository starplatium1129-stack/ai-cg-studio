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
      "points": [x,y,c, ...] }
    x/y 量化到 0..1000（相对人物包围盒）；c = 调色板序号（k-means 提取的
    人物真实主色，蓝发/黑白女仆装等按色块成像）。

采样策略：
    rembg(alpha_matting) 抠人物 → 降到 160px 宽 → 包围盒裁剪 →
    k-means 主色调色板 + 轮廓权重 5 / 结构线（亮度梯度）权重 3 /
    内部按亮度加权 → 确定性加权采样 2400 点 → 按行带排序输出。
"""
import json
import random
import sys
from pathlib import Path

from PIL import Image
import numpy as np
from rembg import remove, new_session

ROOT = Path(__file__).resolve().parents[2]
CHAR_DIR = ROOT / "assets" / "characters"
OUT_DIR = ROOT / "assets" / "particles"
POINT_BUDGET = 2400
PALETTE_SIZE = 6
ALPHA_OPAQUE = 60
OUTLINE_WEIGHT = 5.0
STRUCTURE_WEIGHT = 3.0
INTERIOR_BASE = 0.5

# 工作室角色立绘文件名与角色 id 的对应（热门角色固定 popular-<id>.png）
STUDIO_PORTRAITS = {"nene": "nene-official.webp", "natsume": "natsume-official.webp"}


def luminance(rgb: np.ndarray) -> np.ndarray:
    return (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0


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


def candidates_from_image(image: Image.Image) -> tuple[list[tuple[float, float, int]], float, list[str]] | None:
    """返回 ([(x01, y01, 调色板序号), ...], bbox 宽高比, 调色板)；抠不出人物返回 None。"""
    cut = remove(image.convert("RGBA"), session=SESSION, alpha_matting=True)
    # 限宽采样：160px 平衡轮廓细节与点云噪声（前端按粒子预算二次采样）
    w0, h0 = cut.size
    scale = 160.0 / w0
    small = cut.resize((160, max(1, round(h0 * scale))), Image.LANCZOS)
    arr = np.array(small)
    alpha = arr[..., 3]
    mask = alpha > ALPHA_OPAQUE
    if mask.sum() < 220:  # ~2% 以下认为抠图失败
        return None
    rgb = arr[..., :3]
    lum = luminance(rgb.astype(float))

    # 主色：k-means 提取人物真实配色（蓝发/黑白女仆装等按色块成像）
    palette_rgb = kmeans_palette(rgb, mask, PALETTE_SIZE, image.filename if hasattr(image, "filename") else "seed")
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

    # 轮廓：不透明且四邻存在透明
    padded = np.pad(mask, 1, constant_values=False)
    neighbors = padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    outline = mask & ~neighbors

    # 内部结构线：亮度梯度（Sobel 近似）——眼眶/领口/围裙边等线条加权
    gy, gx = np.gradient(lum)
    grad = np.sqrt(gx * gx + gy * gy)
    structure = mask & (grad > 0.16) & ~outline

    candidates: list[tuple[float, float, int]] = []
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if not mask[y, x]:
                continue
            if outline[y, x]:
                weight = OUTLINE_WEIGHT
            elif structure[y, x]:
                weight = STRUCTURE_WEIGHT
            else:
                weight = INTERIOR_BASE + lum[y, x] * 0.85
            wx = int(round(weight * 4))  # 权重 → 重复份数（0.25 粒度）
            if wx <= 0:
                continue
            for _ in range(wx):
                candidates.append((
                    (x - x0) / max(1, x1 - x0),
                    (y - y0) / max(1, y1 - y0),
                    int(color_index[y, x]),
                ))
    if len(candidates) < 120:
        return None
    aspect = (x1 - x0) / max(1, y1 - y0)
    palette = ["#%02x%02x%02x" % c for c in palette_rgb]
    return candidates, aspect, palette


def build_one(char_id: str, source: Path) -> bool:
    image = Image.open(source)
    result = candidates_from_image(image)
    if result is None:
        print(f"[skip] {char_id}: 抠图失败或人物过小（{source.name}）")
        return False
    candidates, aspect, palette = result

    rng = random.Random(char_id)
    rng.shuffle(candidates)
    picked = candidates[:POINT_BUDGET]
    if len(picked) < 90:
        print(f"[skip] {char_id}: 有效点不足（{len(picked)}）")
        return False
    # 加权采样不足预算时按权重随机补齐（同一候选可重复，密度表达仍按权重分布）
    rng2 = random.Random(char_id + "topup")
    while len(picked) < POINT_BUDGET and candidates:
        picked.append(candidates[rng2.randrange(len(candidates))])

    points: list[int] = []
    for x, y, color in sorted(picked, key=lambda p: (round(p[1] * 18), p[0])):
        points.extend((round(x * 1000), round(y * 1000), color))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"p_{char_id}.json"
    out.write_text(json.dumps({"id": char_id, "aspect": round(aspect, 4), "palette": palette, "points": points}, separators=(",", ":")), encoding="utf-8")
    print(f"[ok] {char_id}: {len(picked)} 点 {len(palette)} 色 → {out.relative_to(ROOT)} ({out.stat().st_size // 1024}KB)")
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
