#!/usr/bin/env python3
"""Run the project's existing WD14 tagger over the selected Nene v18 images.

This stage is deliberately read-only with respect to captions.  It records the
raw thresholded WD14 output and its provenance so a second, visual-review stage
can remove false positives and redundant tags before any training resumes.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from datetime import datetime
from pathlib import Path
from types import ModuleType


IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_tagger_module(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location("project_wd14_tagger", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"unable to load tagger module: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset",
        type=Path,
        default=Path(r"E:\code\2\lora\AI\Datasets\Characters\Ayachi_Nene\V18_Unified"),
    )
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
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    dataset = args.dataset.resolve()
    manifest_path = dataset / "dataset-manifest.json"
    output = (
        args.output.resolve()
        if args.output
        else dataset / "wd14-raw-tags.json"
    )
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entries = manifest.get("entries", [])
    if len(entries) != 55:
        raise RuntimeError(f"expected 55 selected entries, found {len(entries)}")

    tagger_script = args.tagger_script.resolve()
    tagger_model = args.tagger_model.resolve()
    required_model_files = (tagger_model / "model.onnx", tagger_model / "selected_tags.csv")
    missing = [str(path) for path in (tagger_script, *required_model_files) if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"missing WD14 dependency: {missing}")

    module = load_tagger_module(tagger_script)
    tagger = module.Wd14Tagger(tagger_model, args.threshold)
    results: list[dict[str, object]] = []
    for index, entry in enumerate(entries, start=1):
        relative = Path(str(entry["file"]))
        if relative.suffix.lower() not in IMAGE_SUFFIXES:
            raise RuntimeError(f"unsupported selected image: {relative}")
        image_path = dataset / relative
        digest = sha256(image_path)
        expected_digest = str(entry["export_sha256"])
        if digest != expected_digest:
            raise RuntimeError(
                f"selected image changed after audit: {relative} "
                f"(expected {expected_digest}, got {digest})"
            )
        tags = tagger.predict(image_path)
        results.append(
            {
                "id": entry["id"],
                "file": relative.as_posix(),
                "export_sha256": digest,
                "r18": bool(entry["r18"]),
                "outfit_role": entry.get("outfit_role", ""),
                "wd14_tags": tags,
            }
        )
        print(f"[{index:02d}/{len(entries):02d}] {entry['id']}: {len(tags)} tags", flush=True)

    report = {
        "schema": "ai-cg-studio.nene-v18-wd14-raw/v1",
        "created_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "caption_write_performed": False,
        "dataset_manifest": str(manifest_path),
        "dataset_manifest_sha256": sha256(manifest_path),
        "tagger": {
            "implementation": str(tagger_script),
            "implementation_sha256": sha256(tagger_script),
            "model_dir": str(tagger_model),
            "model_sha256": sha256(tagger_model / "model.onnx"),
            "selected_tags_sha256": sha256(tagger_model / "selected_tags.csv"),
            "threshold": args.threshold,
            "providers": tagger.session.get_providers(),
            "general_category_only": True,
        },
        "entry_count": len(results),
        "entries": results,
    }
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(output), "entry_count": len(results)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
