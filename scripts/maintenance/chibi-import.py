"""chibi-import.py — 解包 Q 版 SD 素材导入工具

从 VisualPipeline/decoded 解包产物中挑选的 Q 版事件 CG 转换为网站用
webp（展示 480px + 灯箱 960px 两档），输出到项目 assets/chibi/。

用法: python scripts/maintenance/chibi-import.py
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(r"E:\code\2\lora\AI\Assets\VisualPipeline\decoded")
OUT = os.path.join(ROOT, "assets", "chibi")

# (源文件, 输出名, 展示宽, 灯箱宽)
# 选图标准：Q 版 SD 中景构图（人物头部/呆毛完整入镜）、背景干净、无英文
# 贴纸/漫画框覆盖。2026-08-01 换入 nene-study / natsume-coffee，移除特写
# 裁切（nene-smile）与带英文黑框（natsume-shy）的图。
JOBS = [
    ("nene/ev/entry_00057_5039.png", "nene-study", 480, 960),
    ("nene/ev/entry_00033_5021.png", "nene-happy", 480, 960),
    ("nene/ev/entry_00044_502c.png", "nene-night", 480, 960),
    ("natsume/ev/entry_00140_508c.png", "natsume-coffee", 480, 960),
    ("natsume/ev/entry_00080_5050.png", "natsume-feed", 480, 960),
    ("natsume/ev/entry_00200_50c8.png", "natsume-cafe", 480, 960),
]


def convert(src_path, dst_path, width):
    with Image.open(src_path) as im:
        im = im.convert("RGBA")
        ratio = width / im.width
        im = im.resize((width, max(1, round(im.height * ratio))), Image.LANCZOS)
        bg = Image.new("RGBA", im.size, (17, 11, 34, 255))
        bg.alpha_composite(im)
        bg.convert("RGB").save(dst_path, "WEBP", quality=82, method=6)
    return os.path.getsize(dst_path)


def main():
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for rel, name, view_w, full_w in JOBS:
        src = os.path.join(SRC, rel)
        if not os.path.exists(src):
            print(f"SKIP 缺少源文件: {src}")
            continue
        view = os.path.join(OUT, f"{name}.webp")
        full = os.path.join(OUT, f"{name}-full.webp")
        for dst, w in ((view, view_w), (full, full_w)):
            size = convert(src, dst, w)
            total += size
            print(f"  {os.path.basename(dst):24s} {size / 1024:7.1f} KB")
    print(f"完成: {total / 1024:.1f} KB 写入 {OUT}")


if __name__ == "__main__":
    sys.exit(main())
