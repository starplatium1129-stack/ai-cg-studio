"""Generate a blinded, fixed-seed v15/v16 Ayachi Nene LoRA gate.

The gate intentionally compares several v16 inference weights against the
current v15 website baseline.  It keeps model, prompt, sampler, seed, size and
negative prompt fixed, writes every source image, and produces blinded sheets
for manual inspection against official references.
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
OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\nene_v16_gate_2026-07-29")
REFERENCES = Path(r"E:\code\2\lora\AI\Assets\VisualPipeline\official_refs")
EXPECTED_CHECKPOINT = "waiIllustriousSDXL_v170"
SEEDS = [1038976852, 2784519, 864202607]
WIDTH = 832
HEIGHT = 1216
STEPS = 30
CFG_SCALE = 6
SAMPLER = "Euler a"
NEGATIVE = (
    "lowres, worst_quality, low_quality, normal_quality, blurry, bad_anatomy, "
    "bad_hands, extra_fingers, missing_fingers, fused_fingers, extra_limbs, "
    "malformed_limbs, cross-eyed, asymmetrical_eyes, wrong_eye_color, "
    "wrong_hair_color, duplicate_character, multiple_girls, text, watermark, "
    "logo, signature, jpeg_artifacts"
)


@dataclass(frozen=True)
class Candidate:
    code_name: str
    lora: str
    weight: float


@dataclass(frozen=True)
class Test:
    name: str
    prompt: str
    reference: Path
    reference_crop: str = "full"
    negative_extra: str = ""


CANDIDATES = [
    Candidate("v15-0.80", "ayachi_nene_v15", 0.80),
    Candidate("v16-0.60", "ayachi_nene_v16_eval", 0.60),
    Candidate("v16-0.70", "ayachi_nene_v16_eval", 0.70),
    Candidate("v16-0.80", "ayachi_nene_v16_eval", 0.80),
]

QUALITY = "masterpiece, best_quality, very_aesthetic, absurdres"
IDENTITY = (
    "adult woman, 1girl, solo, ayachi_nene, white_hair, very_long_hair, "
    "low_twintails, purple_eyes, ahoge, pink_hair_ribbons"
)
TESTS = [
    Test(
        "face-minimal-trigger",
        f"{QUALITY}, adult woman, 1girl, solo, ayachi_nene, head_and_shoulders, "
        "centered_face, frontal_view, looking_at_viewer, calm_gentle_expression, "
        "closed_mouth, simple_background, soft_even_lighting",
        REFERENCES / "nene_stand_02.png",
        "face",
    ),
    Test(
        "face-three-quarter",
        f"{QUALITY}, {IDENTITY}, close-up_portrait, three-quarter_view, "
        "looking_at_viewer, shy_gentle_smile, light_blush, simple_background, "
        "soft_even_lighting",
        REFERENCES / "nene_stand_03.png",
        "face",
    ),
    Test(
        "school-uniform",
        f"{QUALITY}, {IDENTITY}, full_body, standing, navy_school_blazer, "
        "gold_trim, gold_buttons, white_shirt, gray_pleated_skirt, "
        "black_thighhighs, black_mary_janes, official_school_uniform, "
        "looking_at_viewer, simple_background, soft_even_lighting",
        REFERENCES / "nene_stand_02.png",
    ),
    Test(
        "witch-outfit",
        f"{QUALITY}, {IDENTITY}, full_body, standing, large_black_witch_hat, "
        "pink_striped_hatband, large_pink_hat_bow, black_short_cape, "
        "vivid_pink_cape_lining, pink_crisscross_strappy_top, pink_collar, "
        "gold_buckle, exposed_midriff, black_pleated_miniskirt, "
        "asymmetrical_legwear, one_black_and_white_striped_thighhigh, "
        "one_white_frilled_sock, black_strappy_boots, holding_silver_handgun_downward, "
        "official_witch_outfit, looking_at_viewer, simple_background",
        REFERENCES / "nene_stand_01.png",
    ),
    Test(
        "adult-interaction",
        f"{QUALITY}, {IDENTITY}, mature_character, official_witch_outfit, "
        "large_black_witch_hat, black_short_cape, vivid_pink_cape_lining, "
        "pink_crisscross_strappy_top, adult_male_partner, romantic_embrace, "
        "both_fully_clothed, upper_body, cinematic_night_interior, warm_rim_light, "
        "Nene_face_clearly_visible, shy_expression",
        REFERENCES / "nene_stand_01.png",
        "face",
    ),
]


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


def validate_environment() -> dict:
    options = api_get("/sdapi/v1/options")
    if not isinstance(options, dict):
        raise RuntimeError("WebUI returned invalid options")
    checkpoint = str(options.get("sd_model_checkpoint", ""))
    if EXPECTED_CHECKPOINT.lower() not in checkpoint.lower():
        raise RuntimeError(
            f"expected {EXPECTED_CHECKPOINT}, but WebUI loaded {checkpoint or '<unknown>'}"
        )
    loras = api_get("/sdapi/v1/loras")
    available = {str(item.get("name")) for item in loras if isinstance(item, dict)}
    required = {candidate.lora for candidate in CANDIDATES}
    missing = sorted(required - available)
    if missing:
        raise RuntimeError(f"missing LoRA(s): {', '.join(missing)}")
    return options


def safe_name(value: str) -> str:
    return value.replace(".", "p")


def generate() -> list[dict]:
    records: list[dict] = []
    total = len(SEEDS) * len(TESTS) * len(CANDIDATES)
    current = 0
    image_dir = OUTPUT / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    for seed in SEEDS:
        for test in TESTS:
            for candidate in CANDIDATES:
                current += 1
                filename = (
                    f"seed-{seed}_{test.name}_{safe_name(candidate.code_name)}.png"
                )
                image_path = image_dir / filename
                prompt = (
                    f"{test.prompt}, <lora:{candidate.lora}:{candidate.weight:.2f}>"
                )
                payload = {
                    "prompt": prompt,
                    "negative_prompt": ", ".join(
                        part for part in (NEGATIVE, test.negative_extra) if part
                    ),
                    "seed": seed,
                    "steps": STEPS,
                    "cfg_scale": CFG_SCALE,
                    "sampler_name": SAMPLER,
                    "width": WIDTH,
                    "height": HEIGHT,
                    "batch_size": 1,
                    "n_iter": 1,
                    "send_images": True,
                    "save_images": False,
                }
                if image_path.exists() and image_path.stat().st_size > 100_000:
                    print(
                        f"[{current}/{total}] reuse {test.name} "
                        f"{candidate.code_name} seed={seed}",
                        flush=True,
                    )
                else:
                    print(
                        f"[{current}/{total}] generate {test.name} "
                        f"{candidate.code_name} seed={seed}",
                        flush=True,
                    )
                    result = api_post("/sdapi/v1/txt2img", payload)
                    images = result.get("images") or []
                    if not images:
                        raise RuntimeError(f"WebUI returned no image for {filename}")
                    image_path.write_bytes(
                        base64.b64decode(str(images[0]).split(",", 1)[-1])
                    )
                records.append(
                    {
                        "test": test.name,
                        "seed": seed,
                        "version": candidate.code_name,
                        "lora": candidate.lora,
                        "weight": candidate.weight,
                        "file": str(image_path),
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
        image = image.crop((int(width * 0.08), 0, int(width * 0.92), int(height * 0.42)))
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


def blind_mapping(test_name: str, seed: int) -> dict[str, str]:
    versions = [candidate.code_name for candidate in CANDIDATES]
    random.Random(f"nene-v16-gate-{test_name}-{seed}-2026-07-29").shuffle(versions)
    return dict(zip(("A", "B", "C", "D"), versions, strict=True))


def make_sheets(records: list[dict]) -> dict[str, dict[str, str]]:
    by_key = {
        (record["test"], record["seed"], record["version"]): record
        for record in records
    }
    mappings: dict[str, dict[str, str]] = {}
    sheet_dir = OUTPUT / "blinded_sheets"
    sheet_dir.mkdir(parents=True, exist_ok=True)
    cell = (300, 438)
    label_height = 46
    font = ImageFont.load_default()
    for seed in SEEDS:
        for test in TESTS:
            mapping = blind_mapping(test.name, seed)
            key = f"{test.name}_seed-{seed}"
            mappings[key] = mapping
            sheet = Image.new(
                "RGB",
                (cell[0] * (len(mapping) + 1), cell[1] + label_height),
                "#f7f3ef",
            )
            draw = ImageDraw.Draw(sheet)
            sheet.paste(reference_image(test, cell), (0, 0))
            draw.text((10, cell[1] + 13), "OFFICIAL", fill="#211c24", font=font)
            for column, code in enumerate(("A", "B", "C", "D"), start=1):
                version = mapping[code]
                record = by_key[(test.name, seed, version)]
                sheet.paste(fit(Path(record["file"]), cell), (column * cell[0], 0))
                draw.text(
                    (column * cell[0] + 10, cell[1] + 13),
                    f"CANDIDATE {code}",
                    fill="#211c24",
                    font=font,
                )
            sheet.save(sheet_dir / f"{key}.jpg", quality=96, subsampling=0)
    return mappings


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    options = validate_environment()
    records = generate()
    mappings = make_sheets(records)
    manifest = {
        "schema": "ai-cg-studio.nene-v16-manual-gate.v1",
        "purpose": "fixed-seed blinded v15/v16 identity and outfit comparison",
        "checkpoint_gate": EXPECTED_CHECKPOINT,
        "priority": {
            "face_and_facial_proportions": 0.40,
            "hair_and_signature_accessories": 0.20,
            "official_outfit_fidelity": 0.25,
            "anatomy_and_render_quality": 0.15,
        },
        "hard_gates": {
            "critical_identity_error": 0,
            "witch_asymmetrical_legwear_presence_rate": 0.67,
            "duplicate_or_feature_swap_rate": 0,
        },
        "webui_options": {
            "sd_model_checkpoint": options.get("sd_model_checkpoint"),
            "CLIP_stop_at_last_layers": options.get("CLIP_stop_at_last_layers"),
        },
        "blind_mappings": mappings,
        "records": records,
    }
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(OUTPUT, flush=True)


if __name__ == "__main__":
    main()
