#!/usr/bin/env python3
"""Record raw WD14 tags for any manifest-backed character dataset.

This is a read-only caption stage.  It accepts the current v16 manifests as
well as the newer curated manifests and binds every result to the exact image
hash before later visual curation.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from datetime import datetime
from pathlib import Path


IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--tagger-script",
        type=Path,
        default=Path(r"E:\code\2\lora\AI\Utilities\v15\tag_dataset_v15.py"),
    )
    parser.add_argument(
        "--tagger-model",
        type=Path,
        default=Path(r"E:\code\2\lora\Models\wd14_tagger"),
    )
    parser.add_argument("--threshold", type=float, default=0.35)
    args = parser.parse_args()

    dataset = args.dataset.resolve()
    manifest_path = dataset / "dataset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("entries", [])
    if not entries:
        raise RuntimeError(f"no manifest entries in {manifest_path}")

    spec = importlib.util.spec_from_file_location("project_wd14_tagger", args.tagger_script)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to load tagger: {args.tagger_script}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    tagger = module.Wd14Tagger(args.tagger_model.resolve(), args.threshold)

    results: list[dict[str, object]] = []
    for index, entry in enumerate(entries, start=1):
        relative = Path(str(entry["file"]))
        if relative.is_absolute() or ".." in relative.parts:
            raise RuntimeError(f"unsafe manifest path: {relative}")
        image_path = dataset / relative
        if image_path.suffix.lower() not in IMAGE_SUFFIXES or not image_path.is_file():
            raise RuntimeError(f"missing or unsupported image: {image_path}")
        digest = sha256(image_path)
        expected = str(entry.get("export_sha256") or entry.get("sha256") or "")
        if expected and digest != expected:
            raise RuntimeError(f"hash mismatch for {relative}: expected {expected}, got {digest}")
        tags = tagger.predict(image_path)
        results.append(
            {
                "id": str(entry.get("id") or image_path.stem),
                "file": relative.as_posix(),
                "source": str(entry.get("source", "")),
                "category": str(entry.get("category", "")),
                "sha256": digest,
                "wd14_tags": tags,
            }
        )
        print(f"[{index:03d}/{len(entries):03d}] {relative}: {len(tags)} tags", flush=True)

    report = {
        "schema": "ai-cg-studio.character-wd14-raw/v1",
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "caption_write_performed": False,
        "dataset_manifest": str(manifest_path),
        "dataset_manifest_sha256": sha256(manifest_path),
        "tagger": {
            "implementation": str(args.tagger_script.resolve()),
            "model_dir": str(args.tagger_model.resolve()),
            "threshold": args.threshold,
            "providers": tagger.session.get_providers(),
            "general_category_only": True,
        },
        "entry_count": len(results),
        "entries": results,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"output": str(args.output), "entry_count": len(results)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
