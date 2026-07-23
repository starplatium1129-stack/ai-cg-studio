"""Build reusable two-character OpenPose maps from the approved showcase."""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path
from urllib.request import Request, urlopen


PROJECT_ROOT = Path(__file__).resolve().parents[1]
AI_ROOT = PROJECT_ROOT.parent / "AI"
DEFAULT_SHOWCASE = AI_ROOT / "SceneShowcase" / "2026-07-22_v14" / "images"
DEFAULT_OUTPUT = PROJECT_ROOT / "assets" / "dual-poses"


def post_json(url: str, payload: dict, timeout: int = 600) -> dict:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def decode_image(value: str) -> bytes:
    encoded = value.split(",", 1)[-1]
    return base64.b64decode(encoded)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://127.0.0.1:7860")
    parser.add_argument("--showcase", type=Path, default=DEFAULT_SHOWCASE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--module", default="openpose_full")
    parser.add_argument("--resolution", type=int, default=768)
    parser.add_argument("--ids", default="")
    parser.add_argument("--timeout", type=int, default=600)
    args = parser.parse_args()

    scenes = json.loads((PROJECT_ROOT / "data" / "scenes.json").read_text(encoding="utf-8"))
    requested = {value.strip() for value in args.ids.split(",") if value.strip()}
    dual_ids = [
        scene["id"] for scene in scenes
        if scene.get("char") == "triad" and (not requested or scene["id"] in requested)
    ]
    args.output.mkdir(parents=True, exist_ok=True)

    manifest = {
        "version": 1,
        "module": args.module,
        "resolution": args.resolution,
        "source": str(args.showcase.resolve()),
        "poses": {},
    }
    for scene_id in dual_ids:
        source = args.showcase / f"{scene_id}.jpg"
        if not source.is_file():
            raise FileNotFoundError(f"Approved showcase image not found: {source}")
        payload = {
            "controlnet_module": args.module,
            "controlnet_input_images": [base64.b64encode(source.read_bytes()).decode("ascii")],
            "controlnet_processor_res": args.resolution,
            "controlnet_threshold_a": 64,
            "controlnet_threshold_b": 64,
        }
        result = post_json(f"{args.api.rstrip('/')}/controlnet/detect", payload, timeout=args.timeout)
        images = result.get("images") or []
        if not images:
            raise RuntimeError(f"ControlNet returned no pose map for {scene_id}")
        target = args.output / f"{scene_id}.png"
        target.write_bytes(decode_image(images[0]))
        manifest["poses"][scene_id] = target.name
        print(f"{scene_id}: {target}")

    (args.output / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(dual_ids)} dual pose maps.")


if __name__ == "__main__":
    main()
