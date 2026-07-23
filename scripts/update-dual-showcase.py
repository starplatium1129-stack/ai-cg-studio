"""Publish directly reviewed dual candidates into the live scene showcase."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
AI_ROOT = ROOT.parent / "AI"
DEFAULT_SHOWCASE = AI_ROOT / "SceneShowcase" / "2026-07-22_v14"
DEFAULT_CANDIDATES = AI_ROOT / "Reviews" / "DualShowcase" / "2026-07-23_regional_v1"
SELECTIONS = {
    "sc028": 6,
    "sc031": 8,
    "sc144": 5,
    "sc151": 4,
    "sc154": 4,
    "sc157": 7,
}


def load_builder():
    source = ROOT / "scripts" / "build-scene-showcase.py"
    spec = importlib.util.spec_from_file_location("scene_showcase_builder", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--showcase", type=Path, default=DEFAULT_SHOWCASE)
    parser.add_argument("--candidates", type=Path, default=DEFAULT_CANDIDATES)
    args = parser.parse_args()
    showcase = args.showcase.resolve()
    allowed_root = (AI_ROOT / "SceneShowcase").resolve()
    if allowed_root not in showcase.parents:
        raise SystemExit(f"Refusing to update showcase outside {allowed_root}")

    builder = load_builder()
    scenes = {scene["id"]: scene for scene in json.loads((ROOT / "data" / "scenes.json").read_text(encoding="utf-8"))}
    manifest_path = showcase / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = []
    for old in manifest["entries"]:
        scene = scenes.get(old["id"])
        if not scene:
            continue
        entry = {
            "id": scene["id"],
            "title": scene["title"],
            "category": scene["category"],
            "story": scene["story"],
            "char": scene["char"],
            "rating": scene["rating"],
            "attempt": SELECTIONS.get(scene["id"], old.get("attempt", 1)),
            "image": f"images/{scene['id']}.jpg",
            "thumb": f"thumbs/{scene['id']}.jpg",
            "source": showcase / "images" / f"{scene['id']}.jpg",
        }
        entries.append(entry)

    if len(entries) != len(scenes):
        missing = sorted(set(scenes) - {entry["id"] for entry in entries})
        raise SystemExit(f"Showcase is missing active scenes: {missing}")

    active_ids = set(scenes)
    for folder in (showcase / "images", showcase / "thumbs"):
        for candidate in folder.glob("sc*.jpg"):
            if candidate.stem not in active_ids:
                candidate.unlink()

    for scene_id, attempt in SELECTIONS.items():
        source = args.candidates / "images" / scene_id / f"attempt-{attempt}.png"
        if not source.is_file():
            raise SystemExit(f"Missing selected candidate: {source}")
        with Image.open(source) as image:
            builder.save_jpeg(image, showcase / "images" / f"{scene_id}.jpg", (1800, 1400), 94)
            builder.save_jpeg(image, showcase / "thumbs" / f"{scene_id}.jpg", (560, 420), 86)

    sheets = showcase / "sheets"
    if sheets.exists():
        shutil.rmtree(sheets)
    sheet_manifest = []
    for rating in builder.RATING_ORDER:
        group = [entry for entry in entries if entry["rating"] == rating]
        pages = math.ceil(len(group) / 12)
        folder = f"{builder.RATING_ORDER.index(rating) + 1:02d}-{rating.lower()}"
        for page_index in range(pages):
            batch = group[page_index * 12:(page_index + 1) * 12]
            relative = Path("sheets") / folder / f"{page_index + 1:02d}_{batch[0]['id']}-{batch[-1]['id']}.jpg"
            builder.build_sheet(batch, showcase / relative, f"{builder.RATING_LABELS[rating]}场景", page_index + 1, pages)
            sheet_manifest.append({
                "rating": rating,
                "page": page_index + 1,
                "path": relative.as_posix(),
                "sceneIds": [entry["id"] for entry in batch],
            })

    curation = json.loads((ROOT / "data" / "curation.json").read_text(encoding="utf-8"))
    builder.build_cover(entries, curation.get("curatedSceneIds", []), showcase / "00-cover.jpg")
    builder.build_html(entries, showcase)
    clean_entries = [{key: entry[key] for key in ["id", "title", "category", "story", "char", "rating", "attempt", "image", "thumb"]} for entry in entries]
    updated = {
        "version": 2,
        "sourceAudit": "2026-07-23_v14_dual_regional",
        "sceneCount": len(clean_entries),
        "counts": dict(Counter(entry["rating"] for entry in clean_entries)),
        "entries": clean_entries,
        "sheets": sheet_manifest,
        "dualSelections": SELECTIONS,
    }
    manifest_path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (showcase / "README.txt").write_text(
        "AI CG Studio 场景效果展示\n\n"
        f"1. 双击 index.html：搜索、筛选并查看 {len(entries)} 个最终合格场景。\n"
        "2. 00-cover.jpg：适合快速介绍。\n"
        "3. sheets：按全年龄、R15、R18 分开的分页对比图。\n"
        "4. images：最终合格大图；thumbs：网页缩略图。\n\n"
        "R18 内容在网页中默认隐藏，需要主动点击“显示 R18”。\n",
        encoding="utf-8",
    )
    print(json.dumps({"showcase": str(showcase), "scenes": len(entries), "dualSelections": SELECTIONS}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
