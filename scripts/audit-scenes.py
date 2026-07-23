"""Generate and visually audit every published scene against its story.

Artifacts live outside the repository so the project stays clean.  The command
is resumable: completed images and reviews are reused unless --force is passed.
Run with the OneTrainer venv because it already contains Pillow.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"E:\code\2\lora\AI-CG-Studio")
AI_ROOT = Path(r"E:\code\2\lora\AI")
DEFAULT_OUTPUT = AI_ROOT / "Reviews" / "SceneAudits" / "2026-07-22_final"
REFERENCES = AI_ROOT / "Assets" / "VisualPipeline" / "official_refs"
VISION = Path(r"C:\Users\Administrator\vision.js")
API = "http://127.0.0.1:7860"
QUALITY_PREFIX = "masterpiece, best quality, amazing quality"
WIDTH = 1024
HEIGHT = 1344
STEPS = 30
CFG = 6
SAMPLER = "Euler a"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def api_post(path: str, payload: dict) -> dict:
    request = urllib.request.Request(
        API + path,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=1200) as response:
        return json.loads(response.read().decode("utf-8"))


def stable_seed(scene_id: str, attempt: int = 1) -> int:
    digest = hashlib.sha256(f"{scene_id}:quality-gate:{attempt}".encode()).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF


def normalize_prompt(scene: dict) -> str:
    prompt = str(scene.get("prompt") or "").strip().strip(",")
    lowered = prompt.lower().replace("_", " ")
    if "masterpiece" not in lowered:
        prompt = f"{QUALITY_PREFIX}, {prompt}"
    return prompt


def select_scenes(args: argparse.Namespace) -> list[dict]:
    scenes = read_json(ROOT / "data" / "scenes.json")
    wanted_ids = {item.strip() for item in (args.ids or "").split(",") if item.strip()}
    selected = []
    for scene in scenes:
        if wanted_ids and scene["id"] not in wanted_ids:
            continue
        if args.character and scene.get("char") != args.character:
            continue
        if args.rating and str(scene.get("rating", "All")).lower() != args.rating.lower():
            continue
        selected.append(scene)
    if args.offset:
        selected = selected[args.offset :]
    if args.limit:
        selected = selected[: args.limit]
    return selected


def generate_one(scene: dict, output: Path, attempt: int, force: bool) -> dict:
    image_dir = output / "images" / scene["id"]
    image_dir.mkdir(parents=True, exist_ok=True)
    image_path = image_dir / f"attempt-{attempt}.png"
    seed = stable_seed(scene["id"], attempt)
    payload = {
        "prompt": normalize_prompt(scene),
        "negative_prompt": scene.get("negative") or "",
        "seed": seed,
        "steps": STEPS,
        "cfg_scale": CFG,
        "sampler_name": SAMPLER,
        "width": WIDTH,
        "height": HEIGHT,
        "batch_size": 1,
        "n_iter": 1,
        "send_images": True,
        "save_images": False,
    }
    reused = image_path.exists() and image_path.stat().st_size > 100_000 and not force
    if not reused:
        result = api_post("/sdapi/v1/txt2img", payload)
        image_path.write_bytes(base64.b64decode(result["images"][0].split(",", 1)[-1]))
        webui_info = result.get("info", "")
    else:
        webui_info = "reused"
    return {
        "scene_id": scene["id"],
        "attempt": attempt,
        "image": str(image_path),
        "seed": seed,
        "payload": payload,
        "webui_info": webui_info,
        "reused": reused,
    }


def trim_alpha(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox:
        image = image.crop(bbox)
    background = Image.new("RGBA", image.size, "#f6f2ef")
    background.alpha_composite(image)
    return background.convert("RGB")


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    image = image.copy().convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#f6f2ef")
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return canvas


def official_reference(scene: dict) -> Path:
    prompt = str(scene.get("prompt") or "").lower()
    if scene.get("char") == "nene":
        return REFERENCES / ("nene_stand_01.png" if "witch" in prompt else "nene_stand_02.png")
    return REFERENCES / ("natsume_stand_03.png" if "china_dress" in prompt or "qipao" in prompt else "natsume_stand_02.png")


def make_review_sheet(scene: dict, generation: dict, output: Path, force: bool) -> Path:
    sheet_dir = output / "review_sheets"
    sheet_dir.mkdir(parents=True, exist_ok=True)
    sheet_path = sheet_dir / f"{scene['id']}_attempt-{generation['attempt']}.jpg"
    if sheet_path.exists() and not force:
        return sheet_path
    official = trim_alpha(Image.open(official_reference(scene)))
    ow, oh = official.size
    face = official.crop((int(ow * 0.12), 0, int(ow * 0.88), max(1, int(oh * 0.38))))
    face_scale = min(430 / face.width, 620 / face.height)
    face = face.resize(
        (max(1, round(face.width * face_scale)), max(1, round(face.height * face_scale))),
        Image.Resampling.LANCZOS,
    )
    generated = Image.open(generation["image"]).convert("RGB")
    columns = [(face, (430, 620), "OFFICIAL FACE"), (official, (430, 620), "OFFICIAL FULL"), (generated, (880, 1160), "GENERATED SCENE")]
    label_height = 55
    sheet = Image.new("RGB", (1740, 1160 + label_height), "#f6f2ef")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    x = 0
    for image, size, label in columns:
        panel = fit(image, size)
        sheet.paste(panel, (x, (1160 - size[1]) // 2))
        draw.text((x + 12, 1175), label, fill="#211c24", font=font)
        x += size[0]
    sheet.save(sheet_path, quality=95, subsampling=0)
    return sheet_path


def compact_scene_context(scene: dict) -> str:
    fields = {
        "id": scene.get("id"),
        "title": scene.get("title"),
        "character": scene.get("char"),
        "rating": scene.get("rating"),
        "story": scene.get("story"),
        "emotion": scene.get("emotion"),
        "location": scene.get("location"),
        "season": scene.get("season"),
        "time": scene.get("time"),
        "weather": scene.get("weather"),
        "camera": scene.get("camera"),
        "lighting": scene.get("lighting"),
        "prompt": scene.get("prompt"),
    }
    return json.dumps(fields, ensure_ascii=False, separators=(",", ":"))


def vision_prompt(scene: dict) -> str:
    adult_rule = (
        "这是R18场景：仅按成年人语境审核，并检查生成角色是否呈现明确成年体态；若显得未成年或年龄暧昧，列为critical_errors。"
        if str(scene.get("rating", "")).upper() == "R18"
        else "这是非R18场景；若画面出现与分级不符的裸露或性行为，列为critical_errors。"
    )


def scene_review_prompt(scene: dict) -> str:
    adult_rule = (
        "这是 R18 场景：仅按成年人语境审核，并检查生成角色是否呈现明确成年体态；若显得未成年或年龄暧昧，必须列为 critical_errors。"
        if str(scene.get("rating", "")).upper() == "R18"
        else "这是非 R18 场景；若画面出现与分级不符的裸露或性行为，必须列为 critical_errors。"
    )
    return (
        "你是极严格的二次元游戏 CG 质量审核员。图中左侧是官方脸部参考，中间是官方全身参考，右侧是本次生成图。"
        "逐项比较右图与官方角色，不得因为画得精致就放宽身份标准。最重要的是脸型、眼形与比例、神态、发型结构、"
        "发色、瞳色，以及泪痣、发夹、发带、呆毛等标志性装饰。"
        "随后检查右图是否准确呈现故事的地点、时间天气、服装、动作、表情、镜头和关键道具；只做到同类氛围不算匹配。"
        "再检查手指、四肢、身体连接、服装结构、透视、遮挡、文字水印和整体完成度。"
        f"{adult_rule}"
        "只输出一个 JSON 对象，不要 Markdown 代码块或额外解释。字段固定为："
        '{"identity_face":0,"signature_features":0,"story_match":0,"outfit_match":0,'
        '"composition":0,"anatomy":0,"render_quality":0,"official_cg_closeness":0,'
        '"critical_errors":[],"missing_story_elements":[],"identity_errors":[],'
        '"prompt_fix":[],"verdict":"pass|fail","reason":"一句中文结论"}。'
        "所有分数为 0 到 10，可用一位小数。严格门槛是 identity_face>=9、signature_features>=8.8、"
        "story_match>=8.8、outfit_match>=8.5、anatomy>=8、render_quality>=8.5，且没有 critical_errors。"
        "场景资料如下：" + compact_scene_context(scene)
    )
    return (
        "你是极严格的二次元游戏CG质量审核员。图中左侧是官方脸部参考，中间是官方全身参考，右侧是本次生成图。"
        "必须逐项比较右图与官方角色，不得因为画得漂亮就放宽身份标准。最重要的是脸型、眼形和比例、神态、发型结构、发色、瞳色、痣/发夹/发带/呆毛等标志装饰。"
        "随后检查右图是否准确呈现故事发生地点、时间天气、服装、动作、表情、镜头和关键道具；故事不能只做到同类氛围。"
        "再检查手指、四肢、身体连接、服装结构、透视、遮挡、文字水印和整体完成度。"
        f"{adult_rule}"
        "只输出一个JSON对象，不要Markdown代码块，不要解释。字段固定为："
        '{"identity_face":0,"signature_features":0,"story_match":0,"outfit_match":0,'
        '"composition":0,"anatomy":0,"render_quality":0,"official_cg_closeness":0,'
        '"critical_errors":[],"missing_story_elements":[],"identity_errors":[],'
        '"prompt_fix":[],"verdict":"pass|fail","reason":"一句中文结论"}。'
        "所有分数为0到10，可用一位小数。本站采用接近官方CG的严格门槛：只有identity_face>=9、"
        "signature_features>=8.8、story_match>=8.8、outfit_match>=8.5、anatomy>=8、"
        "render_quality>=8.5且无critical_errors时才允许pass。"
        "场景资料如下：" + compact_scene_context(scene)
    )


def extract_json(raw: str) -> dict:
    cleaned = re.sub(r"^.*?\n(?=\{)", "", raw, flags=re.S)
    decoder = json.JSONDecoder()
    candidates = []
    for match in re.finditer(r"\{", cleaned):
        try:
            value, _ = decoder.raw_decode(cleaned[match.start() :])
            if isinstance(value, dict):
                candidates.append(value)
        except json.JSONDecodeError:
            continue
    if not candidates:
        raise ValueError("vision output did not contain JSON")
    candidates.sort(key=lambda value: len(set(value) & {"identity_face", "story_match", "verdict"}), reverse=True)
    return candidates[0]


def score(review: dict, key: str) -> float:
    try:
        return float(review.get(key, 0))
    except (TypeError, ValueError):
        return 0.0


def enforce_verdict(review: dict) -> tuple[str, list[str]]:
    gates = {
        "identity_face": 9.0,
        "signature_features": 8.8,
        "story_match": 8.8,
        "outfit_match": 8.5,
        "anatomy": 8.0,
        "render_quality": 8.5,
    }
    failed = [f"{key}<{minimum}" for key, minimum in gates.items() if score(review, key) < minimum]
    if review.get("critical_errors"):
        failed.append("critical_errors")
    return ("pass" if not failed else "fail", failed)


def review_one(scene: dict, generation: dict, output: Path, force: bool) -> dict:
    report_dir = output / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report_path = report_dir / f"{scene['id']}_attempt-{generation['attempt']}.json"
    if report_path.exists() and not force:
        return read_json(report_path)
    sheet = make_review_sheet(scene, generation, output, force)
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "utf-8"
    completed = subprocess.run(
        ["node", str(VISION), str(sheet), scene_review_prompt(scene)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
        env=environment,
        check=False,
    )
    raw = (completed.stdout or "") + ("\nSTDERR:\n" + completed.stderr if completed.stderr else "")
    try:
        if completed.returncode != 0 or "API 403" in raw or "识图失败" in raw or "璇嗗浘澶辫触" in raw:
            raise RuntimeError("vision service failed: " + raw[-300:].replace("\n", " "))
        review = extract_json(raw)
        required_scores = {"identity_face", "signature_features", "story_match", "outfit_match", "anatomy", "render_quality"}
        if not required_scores.issubset(review):
            raise ValueError("vision output is missing required score fields")
        verdict, gate_failures = enforce_verdict(review)
        review["verdict"] = verdict
        review["gate_failures"] = gate_failures
        status = "reviewed"
    except Exception as exc:
        review = {"verdict": "error", "reason": str(exc), "gate_failures": ["review_service_or_parse_error"]}
        status = "error"
    result = {
        "scene_id": scene["id"],
        "title": scene.get("title"),
        "character": scene.get("char"),
        "rating": scene.get("rating"),
        "attempt": generation["attempt"],
        "image": generation["image"],
        "review_sheet": str(sheet),
        "status": status,
        "review": review,
        "vision_raw": raw,
    }
    write_json(report_path, result)
    return result


def load_generations(output: Path, scenes: list[dict], attempt: int) -> dict[str, dict]:
    manifest_path = output / "generation-manifest.json"
    existing = read_json(manifest_path) if manifest_path.exists() else []
    generations = {(item["scene_id"], int(item["attempt"])): item for item in existing}
    return {scene["id"]: generations[(scene["id"], attempt)] for scene in scenes if (scene["id"], attempt) in generations}


def save_generation_manifest(output: Path, values: dict[tuple[str, int], dict]) -> None:
    write_json(output / "generation-manifest.json", sorted(values.values(), key=lambda item: (item["scene_id"], item["attempt"])))


def run_generate(args: argparse.Namespace, scenes: list[dict], output: Path) -> dict[str, dict]:
    manifest_path = output / "generation-manifest.json"
    existing_list = read_json(manifest_path) if manifest_path.exists() else []
    all_generations = {(item["scene_id"], int(item["attempt"])): item for item in existing_list}
    selected: dict[str, dict] = {}
    for index, scene in enumerate(scenes, start=1):
        print(f"[generate {index}/{len(scenes)}] {scene['id']} {scene.get('title', '')}", flush=True)
        generation = generate_one(scene, output, args.attempt, args.force)
        all_generations[(scene["id"], args.attempt)] = generation
        selected[scene["id"]] = generation
        save_generation_manifest(output, all_generations)
    return selected


def run_review(args: argparse.Namespace, scenes: list[dict], generations: dict[str, dict], output: Path) -> list[dict]:
    jobs = [(scene, generations[scene["id"]]) for scene in scenes if scene["id"] in generations]
    results = []
    with ThreadPoolExecutor(max_workers=max(1, args.vision_workers)) as pool:
        futures = {
            pool.submit(review_one, scene, generation, output, args.force): scene
            for scene, generation in jobs
        }
        done = 0
        for future in as_completed(futures):
            scene = futures[future]
            done += 1
            try:
                result = future.result()
            except Exception as exc:
                result = {
                    "scene_id": scene["id"],
                    "title": scene.get("title"),
                    "status": "error",
                    "review": {"verdict": "error", "reason": str(exc), "gate_failures": ["review_runtime_error"]},
                }
            results.append(result)
            print(f"[review {done}/{len(jobs)}] {scene['id']} -> {result['review'].get('verdict')}", flush=True)
    return results


def write_summary(output: Path, results: list[dict]) -> dict:
    latest: dict[str, dict] = {}
    for result in results:
        current = latest.get(result["scene_id"])
        if not current or int(result.get("attempt", 0)) >= int(current.get("attempt", 0)):
            latest[result["scene_id"]] = result
    manual_path = output / "manual-review.json"
    manual_review = None
    if manual_path.exists():
        try:
            manual_review = read_json(manual_path)
        except (OSError, json.JSONDecodeError):
            manual_review = None
    if isinstance(manual_review, dict):
        for scene_id, record in manual_review.get("records", {}).items():
            base = dict(latest.get(scene_id, {}))
            base.update({
                "scene_id": scene_id,
                "attempt": record.get("attempt", base.get("attempt", 0)),
                "status": "manual-review",
            })
            base_review = dict(base.get("review") or {})
            base_review.update({
                "verdict": record.get("verdict"),
                "reason": record.get("reason"),
                "reviewer": record.get("reviewer"),
                "reviewed_at": record.get("reviewed_at"),
                "gate_failures": [] if record.get("verdict") == "pass" else base_review.get("gate_failures", []),
            })
            base["review"] = base_review
            latest[scene_id] = base
    passed = [item for item in latest.values() if item.get("review", {}).get("verdict") == "pass"]
    failed = [item for item in latest.values() if item.get("review", {}).get("verdict") == "fail"]
    errors = [item for item in latest.values() if item.get("review", {}).get("verdict") == "error"]
    featured = [
        item for item in passed
        if score(item["review"], "identity_face") >= 9.2
        and score(item["review"], "signature_features") >= 9.0
        and score(item["review"], "story_match") >= 9.2
        and score(item["review"], "render_quality") >= 9.0
        and score(item["review"], "official_cg_closeness") >= 9.2
    ]
    featured.sort(
        key=lambda item: (
            score(item["review"], "official_cg_closeness")
            + score(item["review"], "identity_face")
            + score(item["review"], "story_match")
        ),
        reverse=True,
    )
    featured_ids = [item["scene_id"] for item in featured]
    if isinstance(manual_review, dict):
        curation_path = Path(__file__).resolve().parents[1] / "data" / "curation.json"
        if curation_path.exists():
            try:
                featured_ids = read_json(curation_path).get("signatureSceneIds", featured_ids)
            except (OSError, json.JSONDecodeError):
                pass
    summary = {
        "total_reviewed": len(latest),
        "passed": len(passed),
        "failed": len(failed),
        "errors": len(errors),
        "pass_rate": round(len(passed) / len(latest), 4) if latest else 0,
        "approved_scene_ids": sorted(item["scene_id"] for item in passed),
        "failed_scene_ids": sorted(item["scene_id"] for item in failed),
        "error_scene_ids": sorted(item["scene_id"] for item in errors),
        "review_source": "manual-review" if isinstance(manual_review, dict) else "automatic-vision",
        "featured_candidates": featured_ids,
        "results": sorted(latest.values(), key=lambda item: item["scene_id"]),
    }
    write_json(output / "summary.json", summary)
    return summary


def collect_reports(output: Path) -> list[dict]:
    reports = []
    for path in (output / "reports").glob("*.json") if (output / "reports").exists() else []:
        try:
            reports.append(read_json(path))
        except (OSError, json.JSONDecodeError):
            pass
    return reports


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["generate", "review", "run", "summary"])
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--ids", default="")
    parser.add_argument("--character", choices=["nene", "natsume", "triad"])
    parser.add_argument("--rating", choices=["All", "R15", "R18"])
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--attempt", type=int, default=1)
    parser.add_argument("--vision-workers", type=int, default=2)
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    scenes = select_scenes(args)
    print(f"selected {len(scenes)} scenes -> {output}", flush=True)
    generations: dict[str, dict] = {}
    if args.command in {"generate", "run"}:
        generations = run_generate(args, scenes, output)
    if args.command in {"review", "run"}:
        if not generations:
            generations = load_generations(output, scenes, args.attempt)
        run_review(args, scenes, generations, output)
    summary = write_summary(output, collect_reports(output))
    print(json.dumps({key: summary[key] for key in ["total_reviewed", "passed", "failed", "errors", "pass_rate"]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
