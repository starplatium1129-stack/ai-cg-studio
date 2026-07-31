"""Publish directly reviewed v18 core candidates into the live scene showcase."""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import shutil
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
AI_ROOT = ROOT.parent / "AI"
DEFAULT_SHOWCASE = AI_ROOT / "SceneShowcase" / "2026-07-22_v14"
DEFAULT_AUDIT = AI_ROOT / "Reviews" / "SceneAudits" / "2026-07-30_v18_core"


def load_builder():
    source = ROOT / "scripts" / "maintenance" / "build-scene-showcase.py"
    spec = importlib.util.spec_from_file_location("scene_showcase_builder", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--showcase", type=Path, default=DEFAULT_SHOWCASE)
    parser.add_argument("--audit", type=Path, default=DEFAULT_AUDIT)
    args = parser.parse_args()
    showcase = args.showcase.resolve()

    builder = load_builder()
    scenes = {scene["id"]: scene for scene in json.loads((ROOT / "data" / "scenes.json").read_text(encoding="utf-8"))}
    manifest_path = showcase / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    
    review_path = args.audit / "manual-review.json"
    if not review_path.exists():
        raise SystemExit(f"Missing manual review file: {review_path}")
    review = json.loads(review_path.read_text(encoding="utf-8")).get("records", {})

    updated_count = 0
    entries = []
    for old in manifest["entries"]:
        scene_id = old["id"]
        scene = scenes.get(scene_id)
        if not scene:
            continue
        
        attempt = old.get("attempt", 1)
        if scene_id in review and review[scene_id].get("verdict") == "pass":
            attempt = review[scene_id].get("attempt", 1)
            source = args.audit / "images" / scene_id / f"attempt-{attempt}.png"
            if source.is_file():
                with Image.open(source) as image:
                    builder.save_jpeg(image, showcase / "images" / f"{scene_id}.jpg", (1800, 1400), 94)
                    builder.save_jpeg(image, showcase / "thumbs" / f"{scene_id}.jpg", (560, 420), 86)
                updated_count += 1

        entry = {
            "id": scene_id,
            "title": scene["title"],
            "category": scene["category"],
            "story": scene["story"],
            "char": scene["char"],
            "rating": scene["rating"],
            "attempt": attempt,
            "image": f"images/{scene_id}.jpg",
            "thumb": f"thumbs/{scene_id}.jpg",
            "source": showcase / "images" / f"{scene_id}.jpg",
        }
        entries.append(entry)

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
        "version": 3,
        "sourceAudit": "2026-07-30_v18_core",
        "sceneCount": len(clean_entries),
        "counts": dict(Counter(entry["rating"] for entry in clean_entries)),
        "entries": clean_entries,
        "sheets": sheet_manifest,
        "v18CoreUpdated": updated_count,
    }
    manifest_path.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"showcase": str(showcase), "totalScenes": len(entries), "v18UpdatedScenes": updated_count}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
