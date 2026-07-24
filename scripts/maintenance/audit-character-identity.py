"""Generate a blinded, resumable identity-first LoRA comparison.

The audit deliberately hides version names on contact sheets.  Identity tests are
weighted more heavily than outfits when the results are scored later.
"""

from __future__ import annotations

import base64
import json
import random
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


API = "http://127.0.0.1:7860"
ROOT = Path(r"E:\code\2\lora\AI-CG-Studio")
OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\identity_gate_2026-07-22")
REFERENCES = Path(r"E:\code\2\lora\AI\Assets\VisualPipeline\official_refs")
SEEDS = [1038976852, 2784519, 864202607]
WIDTH = 832
HEIGHT = 1216
LORA_WEIGHT = 0.8
NEGATIVE = (
    "lowres, worst_quality, low_quality, normal_quality, bad_anatomy, bad_hands, "
    "extra_fingers, missing_fingers, fused_fingers, extra_limbs, malformed_limbs, "
    "cross-eyed, asymmetrical_eyes, wrong_eye_color, duplicate, text, watermark, "
    "logo, signature, blurry, jpeg_artifacts"
)


@dataclass(frozen=True)
class Test:
    name: str
    prompt: str
    reference: Path
    reference_crop: str = "full"


CHARACTERS = {
    "nene": {
        "candidates": {
            "v11": "ayachi_nene_v11",
            "v12": "ayachi_nene_v12",
            "v13-e15": "ayachi_nene_v13_e15_audit",
            "v13-e30": "ayachi_nene_v13",
            "v13-e45": "ayachi_nene_v13_e45_audit",
        },
        "tests": [
            Test(
                "face-neutral",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, "
                "ahoge, pink_hair_ribbons, head_and_shoulders, centered_face, frontal_view, "
                "looking_at_viewer, calm_gentle_expression, closed_mouth, simple_background, "
                "soft_even_lighting",
                REFERENCES / "nene_stand_02.png",
                "face",
            ),
            Test(
                "face-three-quarter",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, "
                "ahoge, pink_hair_ribbons, close-up_portrait, three-quarter_view, "
                "looking_at_viewer, shy_gentle_smile, light_blush, simple_background, soft_lighting",
                REFERENCES / "nene_stand_03.png",
                "face",
            ),
            Test(
                "school-uniform",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, "
                "ahoge, pink_hair_ribbons, full_body, standing, navy_school_blazer, gold_trim, "
                "white_shirt, gray_pleated_skirt, black_thighhighs, mary_janes, official_outfit, "
                "looking_at_viewer, simple_background",
                REFERENCES / "nene_stand_02.png",
            ),
            Test(
                "witch-outfit",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "ayachi_nene, white_hair, very_long_hair, low_twintails, purple_eyes, "
                "ahoge, pink_hair_ribbons, full_body, standing, large_black_witch_hat, pink_hat_ribbon, "
                "black_cape, pink_cape_lining, pink_strappy_witch_top, exposed_midriff, black_miniskirt, "
                "asymmetrical_black_and_white_striped_legwear, black_boots, official_witch_outfit, "
                "looking_at_viewer, simple_background",
                REFERENCES / "nene_stand_01.png",
            ),
        ],
    },
    "natsume": {
        "candidates": {
            "v11": "shiki_natsume_v11",
            "v12": "shiki_natsume_v12",
            "v13-e15": "shiki_natsume_v13_e15_audit",
            "v13-e30": "shiki_natsume_v13",
            "v13-e45": "shiki_natsume_v13_e45_audit",
        },
        "tests": [
            Test(
                "face-neutral",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "shiki_natsume, black_hair, long_hair, golden_yellow_eyes, mole_under_left_eye, "
                "side_hairclip, head_and_shoulders, centered_face, frontal_view, looking_at_viewer, "
                "reserved_calm_expression, closed_mouth, simple_background, soft_even_lighting",
                REFERENCES / "natsume_stand_02.png",
                "face",
            ),
            Test(
                "face-three-quarter",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "shiki_natsume, black_hair, long_hair, golden_yellow_eyes, mole_under_left_eye, "
                "side_hairclip, close-up_portrait, three-quarter_view, looking_at_viewer, "
                "subtle_shy_smile, light_blush, simple_background, soft_lighting",
                REFERENCES / "natsume_stand_01.png",
                "face",
            ),
            Test(
                "cafe-uniform",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "shiki_natsume, black_hair, long_hair, golden_yellow_eyes, mole_under_left_eye, "
                "side_hairclip, full_body, standing, pink_cafe_uniform, pink_dress, white_frilled_apron, "
                "purple_pumps, official_cafe_uniform, looking_at_viewer, simple_background",
                REFERENCES / "natsume_stand_02.png",
            ),
            Test(
                "qipao-outfit",
                "masterpiece, best_quality, very_aesthetic, absurdres, 1girl, solo, "
                "shiki_natsume, black_hair, golden_yellow_eyes, mole_under_left_eye, hair_bun, "
                "red_hair_flower, full_body, standing, fitted_red_china_dress, high_mandarin_collar, "
                "gold_phoenix_and_flower_embroidery, side_slit, black_pantyhose, red_mary_janes, "
                "official_qipao_outfit, looking_at_viewer, simple_background",
                REFERENCES / "natsume_stand_03.png",
            ),
        ],
    },
}


def api_get(path: str) -> object:
    with urllib.request.urlopen(API + path, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def api_post(path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=900) as response:
        return json.loads(response.read().decode("utf-8"))


def generate() -> list[dict]:
    records: list[dict] = []
    total = sum(len(item["candidates"]) * len(item["tests"]) * len(SEEDS) for item in CHARACTERS.values())
    done = 0
    for character, item in CHARACTERS.items():
        image_dir = OUTPUT / character / "images"
        image_dir.mkdir(parents=True, exist_ok=True)
        for seed in SEEDS:
            for test in item["tests"]:
                for version, lora in item["candidates"].items():
                    done += 1
                    filename = f"seed-{seed}_{test.name}_{version}.png"
                    path = image_dir / filename
                    weight = float(item.get("weight", LORA_WEIGHT))
                    prompt = f"{test.prompt}, <lora:{lora}:{weight}>"
                    payload = {
                        "prompt": prompt,
                        "negative_prompt": NEGATIVE,
                        "seed": seed,
                        "steps": 30,
                        "cfg_scale": 6,
                        "sampler_name": "Euler a",
                        "width": WIDTH,
                        "height": HEIGHT,
                        "batch_size": 1,
                        "n_iter": 1,
                        "send_images": True,
                        "save_images": False,
                    }
                    if path.exists() and path.stat().st_size > 100_000:
                        print(f"[{done}/{total}] reuse {character} {test.name} {version} seed={seed}", flush=True)
                    else:
                        print(f"[{done}/{total}] generate {character} {test.name} {version} seed={seed}", flush=True)
                        result = api_post("/sdapi/v1/txt2img", payload)
                        path.write_bytes(base64.b64decode(result["images"][0].split(",", 1)[-1]))
                    records.append(
                        {
                            "character": character,
                            "test": test.name,
                            "seed": seed,
                            "version": version,
                            "lora": lora,
                            "lora_weight": weight,
                            "file": str(path),
                            "prompt": prompt,
                            "parameters": payload,
                        }
                    )
    return records


def trim_alpha(image: Image.Image) -> Image.Image:
    if image.mode != "RGBA":
        return image.convert("RGB")
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        image = image.crop(bbox)
    background = Image.new("RGBA", image.size, "#f7f3ef")
    background.alpha_composite(image)
    return background.convert("RGB")


def reference_image(test: Test, size: tuple[int, int]) -> Image.Image:
    image = trim_alpha(Image.open(test.reference).convert("RGBA"))
    if test.reference_crop == "face":
        width, height = image.size
        image = image.crop((int(width * 0.12), 0, int(width * 0.88), int(height * 0.38)))
        # Transparent standing sprites occupy only a small part of the source
        # canvas.  Enlarge the cropped official face to the same visual scale
        # as generated portraits so eye spacing and facial proportions remain
        # judgeable on the blinded sheet.
        scale = min(size[0] / image.width, size[1] / image.height)
        image = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
    else:
        image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#f7f3ef")
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return canvas


def fit(path: Path, size: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#f7f3ef")
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return canvas


def blinded_mapping(character: str, test: str, seed: int) -> dict[str, str]:
    versions = list(CHARACTERS[character]["candidates"])
    codes = ["A", "B", "C", "D", "E"]
    random.Random(f"identity-gate-{character}-{test}-{seed}-2026-07-22").shuffle(versions)
    return dict(zip(codes, versions, strict=True))


def make_sheets(records: list[dict]) -> dict[str, dict[str, str]]:
    mappings: dict[str, dict[str, dict[str, str]]] = {}
    by_key = {
        (record["character"], record["test"], record["seed"], record["version"]): record
        for record in records
    }
    cell = (300, 438)
    label_height = 46
    font = ImageFont.load_default()
    for character, item in CHARACTERS.items():
        mappings[character] = {}
        sheet_dir = OUTPUT / character / "blinded_sheets"
        sheet_dir.mkdir(parents=True, exist_ok=True)
        for seed in SEEDS:
            for test in item["tests"]:
                mapping = blinded_mapping(character, test.name, seed)
                mappings[character][f"{test.name}_seed-{seed}"] = mapping
                sheet = Image.new("RGB", (cell[0] * 6, cell[1] + label_height), "#f7f3ef")
                draw = ImageDraw.Draw(sheet)
                sheet.paste(reference_image(test, cell), (0, 0))
                draw.text((10, cell[1] + 13), "OFFICIAL", fill="#211c24", font=font)
                for column, code in enumerate(["A", "B", "C", "D", "E"], start=1):
                    version = mapping[code]
                    record = by_key[(character, test.name, seed, version)]
                    sheet.paste(fit(Path(record["file"]), cell), (column * cell[0], 0))
                    draw.text((column * cell[0] + 10, cell[1] + 13), f"CANDIDATE {code}", fill="#211c24", font=font)
                sheet.save(sheet_dir / f"{test.name}_seed-{seed}.jpg", quality=96, subsampling=0)
    return mappings


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = generate()
    mappings = make_sheets(records)
    metadata = {
        "purpose": "identity-first blinded LoRA gate",
        "priority": {
            "face_and_facial_proportions": 0.45,
            "hair_and_signature_accessories": 0.25,
            "official_outfit_fidelity": 0.15,
            "anatomy_and_render_quality": 0.15,
        },
        "hard_gates": {
            "mean_face_score": 8.5,
            "signature_feature_presence_rate": 0.75,
            "critical_identity_error": 0,
        },
        "webui_options": api_get("/sdapi/v1/options"),
        "blind_mappings": mappings,
        "records": records,
    }
    (OUTPUT / "manifest.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(OUTPUT, flush=True)


if __name__ == "__main__":
    main()
