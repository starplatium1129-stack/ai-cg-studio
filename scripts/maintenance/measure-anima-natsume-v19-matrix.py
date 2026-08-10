"""Measure Natsume v19 TensorBoard validation and product seed diversity."""

from __future__ import annotations

import argparse
import itertools
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageStat
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator


SIZE = (256, 176)
HASH_SIZE = (16, 16)


def image_features(path: Path):
    with Image.open(path) as source:
        rgb = source.convert("RGB").resize(SIZE, Image.Resampling.LANCZOS)
    values = list(rgb.convert("L").resize(HASH_SIZE, Image.Resampling.LANCZOS).getdata())
    mean = sum(values) / len(values)
    average_hash = tuple(value >= mean for value in values)
    edge = rgb.convert("L").filter(ImageFilter.FIND_EDGES).convert("RGB")
    return rgb, edge, average_hash


def difference(left: Image.Image, right: Image.Image) -> float:
    delta = ImageChops.difference(left, right)
    return sum(ImageStat.Stat(delta).mean) / (len(delta.getbands()) * 255)


def diversity(paths: list[Path]) -> dict[str, float]:
    features = [image_features(path) for path in paths]
    pairs = list(itertools.combinations(features, 2))
    return {
        "pixelMad": round(sum(difference(a[0], b[0]) for a, b in pairs) / len(pairs), 6),
        "edgeMad": round(sum(difference(a[1], b[1]) for a, b in pairs) / len(pairs), 6),
        "averageHashDistance": round(sum(sum(x != y for x, y in zip(a[2], b[2])) / len(a[2]) for a, b in pairs) / len(pairs), 6),
    }


def validation(root: Path) -> dict[str, list[dict[str, float]]]:
    result: dict[str, list[dict[str, float]]] = {}
    for event in sorted((root / "tensorboard").rglob("events.out.tfevents.*")):
        accumulator = EventAccumulator(str(event))
        accumulator.Reload()
        for tag in accumulator.Tags().get("scalars", []):
            if "validation" not in tag:
                continue
            result.setdefault(tag, [])
            result[tag].extend({"step": item.step, "value": round(item.value, 9)} for item in accumulator.Scalars(tag))
    for values in result.values():
        values.sort(key=lambda item: item["step"])
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--matrix", type=Path, required=True)
    parser.add_argument("--training-workspace", type=Path, required=True)
    args = parser.parse_args()
    matrix = args.matrix.resolve()
    manifest = json.loads((matrix / "manifest.json").read_text(encoding="utf-8"))
    records = {(item["candidate"], item["sceneId"], item["seed"]): matrix / item["image"] for item in manifest["records"] if item["engine"] == "anima"}
    diversity_result = {}
    for candidate in ["base", "e06", "e08", "e10", "e12", "e14"]:
        diversity_result[candidate] = {}
        for scene in manifest["scenes"]:
            diversity_result[candidate][scene["id"]] = diversity([records[(candidate, scene["id"], seed)] for seed in manifest["seeds"]])
    result = {"version": 1, "validation": validation(args.training_workspace.resolve()), "diversity": diversity_result}
    target = matrix / "metrics.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
