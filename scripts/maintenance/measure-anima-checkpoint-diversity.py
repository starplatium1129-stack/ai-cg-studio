"""Measure seed-to-seed image diversity for Anima checkpoint candidates."""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageStat


SIZE = (256, 176)
HASH_SIZE = (16, 16)


def normalized_difference(left: Image.Image, right: Image.Image) -> float:
    difference = ImageChops.difference(left, right)
    return sum(ImageStat.Stat(difference).mean) / (len(difference.getbands()) * 255)


def average_hash(image: Image.Image) -> tuple[bool, ...]:
    gray = image.convert("L").resize(HASH_SIZE, Image.Resampling.LANCZOS)
    values = list(gray.get_flattened_data()) if hasattr(gray, "get_flattened_data") else list(gray.getdata())
    mean = sum(values) / len(values)
    return tuple(value >= mean for value in values)


def hash_distance(left: tuple[bool, ...], right: tuple[bool, ...]) -> float:
    return sum(a != b for a, b in zip(left, right, strict=True)) / len(left)


def image_features(path: Path) -> tuple[Image.Image, Image.Image, tuple[bool, ...]]:
    with Image.open(path) as source:
        rgb = source.convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    edge = rgb.convert("L").filter(ImageFilter.FIND_EDGES).convert("RGB")
    return rgb, edge, average_hash(rgb)


def metrics(paths: list[Path]) -> dict[str, float]:
    features = [image_features(path) for path in paths]
    pairs = list(itertools.combinations(features, 2))
    return {
        "pixelMad": round(sum(normalized_difference(a[0], b[0]) for a, b in pairs) / len(pairs), 6),
        "edgeMad": round(sum(normalized_difference(a[1], b[1]) for a, b in pairs) / len(pairs), 6),
        "averageHashDistance": round(sum(hash_distance(a[2], b[2]) for a, b in pairs) / len(pairs), 6),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    args = parser.parse_args()

    audit = args.audit.resolve()
    baseline = args.baseline.resolve()
    candidate_manifest = json.loads((audit / "manifest.json").read_text(encoding="utf-8"))
    baseline_manifest = json.loads((baseline / "manifest.json").read_text(encoding="utf-8"))
    candidates = {
        (item["sceneId"], item["seed"], item["candidate"]): audit / item["image"]
        for item in candidate_manifest["records"]
    }
    finals = {
        (item["sceneId"], item["seed"]): baseline / item["image"]
        for item in baseline_manifest["records"]
        if item["engine"] == "anima"
    }
    seeds = sorted({item["seed"] for item in candidate_manifest["records"]})
    result = {"version": 1, "scenes": {}}
    for scene_id in candidate_manifest["scenes"]:
        result["scenes"][scene_id] = {
            "e10": metrics([candidates[(scene_id, seed, "e10")] for seed in seeds]),
            "e20": metrics([candidates[(scene_id, seed, "e20")] for seed in seeds]),
            "e45": metrics([finals[(scene_id, seed)] for seed in seeds]),
        }
    target = audit / "diversity-metrics.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
