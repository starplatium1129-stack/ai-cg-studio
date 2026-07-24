"""Generate resumable WebUI samples for official-CG scene candidates."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import urllib.request
from pathlib import Path


ROOT = Path(r"E:\code\2\lora\AI-CG-Studio")
OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\OfficialCGAudits\2026-07-23_v14")
API = "http://127.0.0.1:7860"
NEGATIVE = (
    "worst quality, low quality, normal quality, lowres, blurry, jpeg artifacts, text, "
    "watermark, logo, signature, bad anatomy, bad hands, extra fingers, missing fingers, "
    "fused fingers, extra arms, extra legs, deformed, bad proportions, duplicate, multiple girls, "
    "wrong hair color, 3d, photorealistic, child, loli, underage, young-looking"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids", default="")
    parser.add_argument("--attempt", type=int, default=1)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def api_post(path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=1200) as response:
        return json.loads(response.read().decode("utf-8"))


def stable_seed(candidate_id: str, attempt: int) -> int:
    digest = hashlib.sha256(f"official-cg:{candidate_id}:{attempt}".encode()).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF


def main() -> None:
    args = parse_args()
    candidates = json.loads(
        (ROOT / "data" / "official-cg-candidates.json").read_text(encoding="utf-8")
    )
    wanted = {value.strip() for value in args.ids.split(",") if value.strip()}
    if wanted:
        candidates = [item for item in candidates if item["id"] in wanted]
    image_dir = OUTPUT / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    records = []

    for index, candidate in enumerate(candidates, start=1):
        width, height = (int(value) for value in candidate["size"].split("×"))
        target = image_dir / f"{candidate['id']}-a{args.attempt}.png"
        seed = stable_seed(candidate["id"], args.attempt)
        payload = {
            "prompt": candidate["prompt"],
            "negative_prompt": ", ".join(
                value for value in (NEGATIVE, candidate.get("negative", "")) if value
            ),
            "seed": seed,
            "steps": 30,
            "cfg_scale": 5.5,
            "sampler_name": "DPM++ 2M",
            "scheduler": "Karras",
            "width": width,
            "height": height,
            "batch_size": 1,
            "n_iter": 1,
            "send_images": True,
            "save_images": False,
        }
        reused = target.exists() and target.stat().st_size > 100_000 and not args.force
        print(f"[{index}/{len(candidates)}] {candidate['id']} {candidate['title']} " + ("reuse" if reused else "generate"), flush=True)
        if not reused:
            result = api_post("/sdapi/v1/txt2img", payload)
            target.write_bytes(base64.b64decode(result["images"][0].split(",", 1)[-1]))
        records.append(
            {
                **candidate,
                "attempt": args.attempt,
                "seed": seed,
                "image": str(target),
                "payload": payload,
            }
        )

    manifest = OUTPUT / f"manifest-a{args.attempt}.json"
    manifest.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    print(manifest, flush=True)


if __name__ == "__main__":
    main()
