"""natsume-live2d-import.py — 夏目 Live2D 模型导入转换

将 LpkUnpackerGUI 解包输出（Live2DViewerEX 风格：Moc.moc3 / model.json /
Textures_*.png / Motions_*.json / Physics.json）转换为项目标准结构
（assets/live2d/natsume/，与宁宁一致），并：
  1. 贴图压缩为 webp（75MB -> 约 20MB）
  2. 重写 model3.json：修正贴图引用、删 Live2DViewerEX 扩展字段(Controllers/
     Options)、删 Sound 引用（源项目 WAV 不得打包，配音由 TTS 负责）、
     Motions 分组重命名为宁宁同款英文分组
  3. 生成 Groups（EyeBlink 从 Controllers 提取）

用法: python scripts/maintenance/natsume-live2d-import.py <src_dir>
"""
import json
import os
import re
import shutil
import sys

from PIL import Image

SRC = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Administrator\Desktop\output\星光咖啡馆与死神之蝶—四季夏目"
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "assets", "live2d", "natsume")

# 解包分组名 -> 项目分组名（宁宁同款，useLive2D INTERACTION_MOTIONS 直接复用）
GROUP_MAP = {
    "Tap外框": "TapFrame",
    "Tap摸腿": "TapLeg",
    "Idle": "Idle",
    "Start": "Start",
    "Tap摸头": "TapHead",
    "Tap摸手": "TapHand",
    "Tap摸胸": "TapChest",
    "Tap摸脚": "TapFoot",
    "Tap摸裙子": "TapSkirt",
    "Leave300_900_1800": "Leave",
}


def main():
    model_path = os.path.join(SRC, "model.json")
    with open(model_path, encoding="utf-8-sig") as f:
        model = json.load(f)

    fr = model["FileReferences"]
    out_textures = os.path.join(OUT, "textures")
    out_motions = os.path.join(OUT, "motions")
    os.makedirs(out_textures, exist_ok=True)
    os.makedirs(out_motions, exist_ok=True)

    # 1. moc3 / physics
    shutil.copyfile(os.path.join(SRC, fr["Moc"]), os.path.join(OUT, "natsume.moc3"))
    shutil.copyfile(os.path.join(SRC, fr["Physics"]), os.path.join(OUT, "natsume.physics3.json"))

    # 2. 贴图：解包工具把 14 张贴图全引用成 Textures_.png（bug），
    #    按真实文件名排序压缩为 webp，并重写引用。Textures_.png 是第一张。
    # Texture indices live inside the moc3. A lexical sort puts __10 before
    # __2, which assigns the wrong atlas to most drawables and tears the model
    # apart at render time. Preserve the source's numeric atlas order instead.
    def texture_index(name):
        match = re.fullmatch(r"Textures_(?:_(\d+))?\.png", name)
        return int(match.group(1)) if match and match.group(1) else 0

    texture_files = sorted(
        (n for n in os.listdir(SRC) if re.fullmatch(r"Textures_(?:_\d+)?\.png", n)),
        key=texture_index,
    )
    texture_refs = []
    total_raw = 0
    for idx, name in enumerate(texture_files):
        src = os.path.join(SRC, name)
        total_raw += os.path.getsize(src)
        dst = os.path.join(out_textures, f"texture_{idx:02d}.webp")
        with Image.open(src) as im:
            im.convert("RGBA").save(dst, "WEBP", quality=90, method=6)
        texture_refs.append(f"textures/texture_{idx:02d}.webp")
    print(f"贴图: {len(texture_files)} 张 {total_raw / 1024 / 1024:.1f}MB -> webp")

    # 3. motions：按分组重命名 + 删 Sound（wav 不打包）
    group_map = {}
    for group, items in fr["Motions"].items():
        mapped = GROUP_MAP.get(group, group)
        for item in items:
            if not item.get("File"):
                continue
            src_name = item["File"]
            stem = os.path.splitext(src_name)[0]
            dst_name = f"{mapped}_{len(group_map.get(mapped, []))}.motion3.json"
            shutil.copyfile(os.path.join(SRC, src_name), os.path.join(out_motions, dst_name))
            item["File"] = "motions/" + dst_name
            item.pop("Sound", None)  # 源项目 WAV 不打包（配音由 TTS 负责）
            item.pop("Text", None)
            item.pop("Intimacy", None)
            group_map.setdefault(mapped, []).append(item)
    print(f"动作: {sum(len(v) for v in group_map.values())} 个")

    # 4. 重写 model3.json
    eye_blink = [it["Id"] for it in (model.get("Controllers") or {}).get("EyeBlink", {}).get("Items", [])]
    manifest = {
        "Version": 3,
        "HitAreas": model.get("HitAreas") or [],
        "FileReferences": {
            "Moc": "natsume.moc3",
            "Textures": texture_refs,
            "Physics": "natsume.physics3.json",
            "Motions": group_map,
        },
        "Groups": [
            {"Target": "Parameter", "Name": "EyeBlink", "Ids": eye_blink or ["ParamEyeLOpen", "ParamEyeROpen"]},
            {"Target": "Parameter", "Name": "LipSync", "Ids": ["ParamMouthOpenY"]},
        ],
    }
    with open(os.path.join(OUT, "natsume.model3.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    total_out = sum(os.path.getsize(os.path.join(dp, n)) for dp, _, ns in os.walk(OUT) for n in ns)
    print(f"完成: {total_out / 1024 / 1024:.1f}MB -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
