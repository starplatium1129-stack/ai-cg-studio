"""Add the visually approved official-CG scenes to the live showcase bundle."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SHOWCASE = ROOT.parent / "AI" / "SceneShowcase" / "2026-07-22_v14"


def save_jpeg(source: Path, target: Path, maximum: tuple[int, int], quality: int) -> None:
    with Image.open(source) as opened:
        image = opened.convert("RGB")
    image.thumbnail(maximum, Image.Resampling.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)


def main() -> None:
    scenes = json.loads((ROOT / "data" / "scenes.json").read_text(encoding="utf-8"))
    approved = [scene for scene in scenes if scene.get("officialCgCandidate")]
    manifest_path = SHOWCASE / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    retained = [entry for entry in manifest["entries"] if int(entry["id"][2:]) < 260]

    additions = []
    for scene in approved:
        audit = scene["audit"]
        source = Path(audit["image"])
        if not source.exists():
            raise SystemExit(f"missing approved image: {source}")
        save_jpeg(source, SHOWCASE / "images" / f"{scene['id']}.jpg", (1800, 1800), 94)
        save_jpeg(source, SHOWCASE / "thumbs" / f"{scene['id']}.jpg", (560, 560), 86)
        additions.append(
            {
                "id": scene["id"],
                "title": scene["title"],
                "category": scene["category"],
                "story": scene["story"],
                "char": scene["char"],
                "rating": scene["rating"],
                "attempt": audit["attempt"],
            }
        )

    manifest["sourceAudit"] = "2026-07-23_v14_official_cg"
    manifest["entries"] = retained + additions
    manifest["sceneCount"] = len(manifest["entries"])
    manifest["counts"] = dict(Counter(entry["rating"] for entry in manifest["entries"]))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"showcase": str(SHOWCASE), "added": len(additions), "total": manifest["sceneCount"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
