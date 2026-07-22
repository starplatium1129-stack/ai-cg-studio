"""Generate final smoke images from the site's upgraded v13 scene prompts."""

from __future__ import annotations

import base64
import json
import urllib.request
from pathlib import Path


ROOT = Path(r"E:\code\2\lora\AI-CG-Studio")
API = "http://127.0.0.1:7860"
OUTPUT = Path(r"E:\code\2\lora\AI\Evaluations\v13_runtime_smoke_2026-07-22")
SCENE_IDS = ["sc128", "sc234"]
NEGATIVE = (
    "lowres, worst_quality, low_quality, normal_quality, bad_anatomy, bad_hands, "
    "extra_fingers, missing_fingers, fused_fingers, extra_limbs, malformed_limbs, "
    "text, watermark, logo, signature, blurry, jpeg_artifacts"
)


def api_json(payload: dict) -> dict:
    request = urllib.request.Request(
        API + "/sdapi/v1/txt2img",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(response.read().decode("utf-8"))


def with_lora(scene: dict) -> str:
    prompt = scene["prompt"]
    if "<lora:" not in prompt:
        prompt = f"{prompt}, <lora:{scene['lora']}:0.85>"
    return prompt


def main() -> None:
    scenes = json.loads((ROOT / "data" / "scenes.json").read_text(encoding="utf-8"))
    by_id = {scene["id"]: scene for scene in scenes}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    for scene_id in SCENE_IDS:
        scene = by_id[scene_id]
        prompt = with_lora(scene)
        payload = {
            "prompt": prompt,
            "negative_prompt": NEGATIVE,
            "seed": 1038976852,
            "steps": 28,
            "cfg_scale": 6,
            "sampler_name": "Euler a",
            "width": 832,
            "height": 1216,
            "batch_size": 1,
            "n_iter": 1,
            "send_images": True,
            "save_images": False,
        }
        print(f"generating {scene_id}: {scene['title']}", flush=True)
        result = api_json(payload)
        image_bytes = base64.b64decode(result["images"][0].split(",", 1)[-1])
        filename = f"{scene_id}.png"
        (OUTPUT / filename).write_bytes(image_bytes)
        records.append({"scene": scene_id, "title": scene["title"], "file": filename, "prompt": prompt})
    (OUTPUT / "manifest.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
