"""Tune the strongest identity checkpoint's LoRA weight against v11."""

from __future__ import annotations

import base64
import importlib.util
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


SOURCE_PATH = Path(__file__).with_name("audit-character-identity.py")
SPEC = importlib.util.spec_from_file_location("character_identity_audit", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
SOURCE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SOURCE
SPEC.loader.exec_module(SOURCE)

OUTPUT = Path(r"E:\code\2\lora\AI\Evaluations\identity_weight_gate_2026-07-22")
BASELINE = Path(r"E:\code\2\lora\AI\Evaluations\identity_gate_2026-07-22")
SEEDS = SOURCE.SEEDS
WEIGHTS = [0.75, 0.80, 0.85, 0.95]
VERSIONS = ["v11-0.80"] + [f"e15-{weight:.2f}" for weight in WEIGHTS]


def selected_tests(character: str) -> list:
    outfit = "witch-outfit" if character == "nene" else "qipao-outfit"
    return [test for test in SOURCE.CHARACTERS[character]["tests"] if test.name in {"face-neutral", "face-three-quarter", outfit}]


def safe_name(version: str) -> str:
    return version.replace(".", "p")


def previous_file(character: str, test: str, seed: int, version: str) -> Path | None:
    old_version = "v11" if version == "v11-0.80" else ("v13-e15" if version == "e15-0.80" else "")
    if not old_version:
        return None
    path = BASELINE / character / "images" / f"seed-{seed}_{test}_{old_version}.png"
    return path if path.exists() else None


def lora_spec(character: str, version: str) -> tuple[str, float]:
    if version == "v11-0.80":
        return (("ayachi_nene_v11" if character == "nene" else "shiki_natsume_v11"), 0.8)
    weight = float(version.rsplit("-", 1)[1])
    return (("ayachi_nene_v13_e15_audit" if character == "nene" else "shiki_natsume_v13_e15_audit"), weight)


def generate() -> list[dict]:
    records = []
    total = 2 * len(SEEDS) * 3 * len(VERSIONS)
    current = 0
    for character in ["nene", "natsume"]:
        image_dir = OUTPUT / character / "images"
        image_dir.mkdir(parents=True, exist_ok=True)
        for seed in SEEDS:
            for test in selected_tests(character):
                for version in VERSIONS:
                    current += 1
                    inherited = previous_file(character, test.name, seed, version)
                    lora, weight = lora_spec(character, version)
                    prompt = f"{test.prompt}, <lora:{lora}:{weight}>"
                    payload = {
                        "prompt": prompt,
                        "negative_prompt": SOURCE.NEGATIVE,
                        "seed": seed,
                        "steps": 30,
                        "cfg_scale": 6,
                        "sampler_name": "Euler a",
                        "width": SOURCE.WIDTH,
                        "height": SOURCE.HEIGHT,
                        "batch_size": 1,
                        "n_iter": 1,
                        "send_images": True,
                        "save_images": False,
                    }
                    if inherited:
                        image_path = inherited
                        print(f"[{current}/{total}] inherit {character} {test.name} {version} seed={seed}", flush=True)
                    else:
                        image_path = image_dir / f"seed-{seed}_{test.name}_{safe_name(version)}.png"
                        if image_path.exists() and image_path.stat().st_size > 100_000:
                            print(f"[{current}/{total}] reuse {character} {test.name} {version} seed={seed}", flush=True)
                        else:
                            print(f"[{current}/{total}] generate {character} {test.name} {version} seed={seed}", flush=True)
                            result = SOURCE.api_post("/sdapi/v1/txt2img", payload)
                            image_path.write_bytes(base64.b64decode(result["images"][0].split(",", 1)[-1]))
                    records.append({
                        "character": character,
                        "test": test.name,
                        "seed": seed,
                        "version": version,
                        "lora": lora,
                        "weight": weight,
                        "file": str(image_path),
                        "prompt": prompt,
                        "parameters": payload,
                    })
    return records


def make_sheets(records: list[dict]) -> dict:
    by_key = {(r["character"], r["test"], r["seed"], r["version"]): r for r in records}
    mappings = {"nene": {}, "natsume": {}}
    cell = (300, 438)
    label_height = 46
    font = ImageFont.load_default()
    for character in ["nene", "natsume"]:
        sheet_dir = OUTPUT / character / "blinded_sheets"
        sheet_dir.mkdir(parents=True, exist_ok=True)
        tests = {test.name: test for test in selected_tests(character)}
        for seed in SEEDS:
            for test_name, test in tests.items():
                shuffled = VERSIONS.copy()
                random.Random(f"weight-gate-{character}-{test_name}-{seed}").shuffle(shuffled)
                mapping = dict(zip(["A", "B", "C", "D", "E"], shuffled, strict=True))
                key = f"{test_name}_seed-{seed}"
                mappings[character][key] = mapping
                sheet = Image.new("RGB", (cell[0] * 6, cell[1] + label_height), "#f7f3ef")
                draw = ImageDraw.Draw(sheet)
                sheet.paste(SOURCE.reference_image(test, cell), (0, 0))
                draw.text((10, cell[1] + 13), "OFFICIAL", fill="#211c24", font=font)
                for column, code in enumerate(["A", "B", "C", "D", "E"], start=1):
                    record = by_key[(character, test_name, seed, mapping[code])]
                    sheet.paste(SOURCE.fit(Path(record["file"]), cell), (column * cell[0], 0))
                    draw.text((column * cell[0] + 10, cell[1] + 13), f"CANDIDATE {code}", fill="#211c24", font=font)
                sheet.save(sheet_dir / f"{key}.jpg", quality=96, subsampling=0)
    return mappings


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = generate()
    mappings = make_sheets(records)
    manifest = {
        "purpose": "LoRA weight gate for v13-e15 against v11",
        "priority": {
            "face_and_facial_proportions": 0.45,
            "hair_and_signature_accessories": 0.25,
            "official_outfit_fidelity": 0.15,
            "anatomy_and_render_quality": 0.15,
        },
        "blind_mappings": mappings,
        "records": records,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(OUTPUT, flush=True)


if __name__ == "__main__":
    main()
