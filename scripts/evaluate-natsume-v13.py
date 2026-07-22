"""Generate a deterministic Natsume v11/v13 comparison grid through WebUI."""

from __future__ import annotations

import base64
import json
import textwrap
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


API = "http://127.0.0.1:7860"
OUTPUT = Path(r"E:\code\2\lora\AI\Evaluations\natsume_v13_2026-07-22")
CANDIDATES = [
    ("v11", "shiki_natsume_v11"),
    ("v13-e15", "shiki_natsume_v13_e15_test"),
    ("v13-e30", "shiki_natsume_v13_e30_test"),
    ("v13-e45", "shiki_natsume_v13_e45_test"),
]
TESTS = [
    (
        "identity",
        "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
        "shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip, "
        "portrait, looking_at_viewer, slight_smile, soft_lighting, simple_background",
    ),
    (
        "qipao",
        "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
        "shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip, "
        "full_body, standing, red_china_dress, china_dress, gold_trim, black_thighhighs, "
        "hair_bun, elegant_pose, indoors, warm_lighting, looking_at_viewer",
    ),
    (
        "control",
        "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
        "shiki_natsume, black_hair, long_hair, yellow_eyes, mole_under_eye, hairclip, "
        "full_body, cafe_uniform, apron, standing, cafe, holding_tray, daylight, looking_at_viewer",
    ),
]
SEEDS = [1038976852, 2784519]
NEGATIVE = (
    "lowres, worst_quality, low_quality, normal_quality, bad_anatomy, bad_hands, "
    "extra_fingers, missing_fingers, fused_fingers, extra_limbs, malformed_limbs, "
    "text, watermark, logo, signature, blurry, jpeg_artifacts"
)


def api_json(path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(response.read().decode("utf-8"))


def generate() -> list[dict]:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    total = len(CANDIDATES) * len(TESTS) * len(SEEDS)
    index = 0
    for seed in SEEDS:
        for test_name, base_prompt in TESTS:
            for candidate_name, lora_name in CANDIDATES:
                index += 1
                prompt = f"{base_prompt}, <lora:{lora_name}:0.85>"
                payload = {
                    "prompt": prompt,
                    "negative_prompt": NEGATIVE,
                    "seed": seed,
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
                print(f"[{index}/{total}] {seed} {test_name} {candidate_name}", flush=True)
                result = api_json("/sdapi/v1/txt2img", payload)
                image_bytes = base64.b64decode(result["images"][0].split(",", 1)[-1])
                filename = f"seed-{seed}_{test_name}_{candidate_name}.png"
                (OUTPUT / filename).write_bytes(image_bytes)
                records.append(
                    {
                        "file": filename,
                        "seed": seed,
                        "test": test_name,
                        "candidate": candidate_name,
                        "lora": lora_name,
                        "prompt": prompt,
                        "negative_prompt": NEGATIVE,
                        "parameters": payload,
                        "webui_info": result.get("info", ""),
                    }
                )
    (OUTPUT / "manifest.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return records


def make_sheet(seed: int, records: list[dict]) -> None:
    thumb_width, thumb_height = 312, 456
    label_height = 58
    sheet = Image.new(
        "RGB",
        (thumb_width * len(CANDIDATES), (thumb_height + label_height) * len(TESTS)),
        "#f7f3ef",
    )
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    by_key = {(record["test"], record["candidate"]): record for record in records if record["seed"] == seed}
    for row, (test_name, _) in enumerate(TESTS):
        for column, (candidate_name, _) in enumerate(CANDIDATES):
            record = by_key[(test_name, candidate_name)]
            image = Image.open(OUTPUT / record["file"]).convert("RGB")
            image.thumbnail((thumb_width, thumb_height), Image.Resampling.LANCZOS)
            x = column * thumb_width + (thumb_width - image.width) // 2
            y = row * (thumb_height + label_height)
            sheet.paste(image, (x, y))
            label = f"{test_name} / {candidate_name}\nseed {seed}"
            draw.multiline_text(
                (column * thumb_width + 8, y + thumb_height + 7),
                textwrap.fill(label, width=34),
                fill="#26212a",
                font=font,
                spacing=3,
            )
    sheet.save(OUTPUT / f"comparison_seed-{seed}.jpg", quality=94, subsampling=0)


def main() -> None:
    records = generate()
    for seed in SEEDS:
        make_sheet(seed, records)
    print(OUTPUT)


if __name__ == "__main__":
    main()
