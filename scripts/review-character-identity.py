"""Score blinded character model sheets against official references."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


OUTPUT = Path(r"E:\code\2\lora\AI\Reviews\ModelEvaluations\identity_gate_2026-07-22")
VISION = Path(r"C:\Users\Administrator\vision.js")
CODES = ["A", "B", "C", "D", "E"]
OUTFIT_TESTS = {"school-uniform", "witch-outfit", "cafe-uniform", "qipao-outfit"}
SEVERE_ERROR_MARKERS = {
    "明显换脸", "完全换脸", "瞳色错误", "眼睛颜色错误", "关键装饰缺失", "完全缺失",
    "多余肢体", "肢体断裂", "严重畸形", "wrong eye color", "missing signature", "identity swap",
}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)


def extract_json(raw: str) -> dict:
    decoder = json.JSONDecoder()
    candidates = []
    for match in re.finditer(r"\{", raw):
        try:
            value, _ = decoder.raw_decode(raw[match.start() :])
            if isinstance(value, dict):
                candidates.append(value)
        except json.JSONDecodeError:
            continue
    if not candidates:
        raise ValueError("vision output did not contain JSON")
    candidates.sort(key=lambda value: len(value.get("scores", {})), reverse=True)
    return candidates[0]


def prompt(character: str, test: str) -> str:
    identity = (
        "绫地宁宁：银白色超长低双马尾、紫色杏仁眼、柔和偏小的脸、细碎刘海与呆毛、粉色发带；不要把一般白发紫瞳女孩误判为宁宁。"
        if character == "nene"
        else "四季夏目：柔和偏瘦的小脸、金黄色眼睛、黑色长发与侧刘海、眼下泪痣、侧边发夹；痣的位置、发夹和眼神都是硬特征。"
    )
    outfit_instruction = (
        "本张是服装测试，outfit_fidelity必须与左侧官方全身参考逐件比较。"
        if test in OUTFIT_TESTS
        else "本张是脸部测试，outfit_fidelity请输出null，不要让服装影响身份判断。"
    )
    return (
        "你是非常严格的二次元角色LoRA盲测审核员。拼图最左是OFFICIAL官方参考，其余是匿名候选A到E。"
        "请逐个候选与官方比较，不得根据位置推断版本，不得因为画得精致就提高角色相似度。"
        f"角色身份基准：{identity}{outfit_instruction}"
        "identity_face重点看脸型轮廓、额头/下巴比例、眼形眼距、眉眼关系、鼻口位置和官方气质；"
        "hair_structure看刘海分束、侧发、长度与扎法；signature_accessories看瞳色及角色专属痣、发夹、发带、呆毛等；"
        "anatomy和render_quality独立评分。任何明显换脸、瞳色错误、发型结构错误、关键装饰缺失都写入critical_errors。"
        "只输出JSON，不要Markdown，不要解释。格式固定为："
        '{"scores":{"A":{"identity_face":0,"hair_structure":0,"signature_accessories":0,'
        '"outfit_fidelity":null,"anatomy":0,"render_quality":0,"critical_errors":[]},'
        '"B":{},"C":{},"D":{},"E":{}},"ranking":["A","B","C","D","E"],'
        '"best":"A","reason":"一句中文结论"}。所有分数0到10，可用一位小数，五个候选都必须完整评分。'
    )


def review_sheet(character: str, sheet: Path) -> dict:
    report_path = OUTPUT / character / "blind_reviews" / (sheet.stem + ".json")
    if report_path.exists():
        existing = json.loads(report_path.read_text(encoding="utf-8"))
        if existing.get("status") == "ok":
            return existing
    test = sheet.stem.rsplit("_seed-", 1)[0]
    environment = os.environ.copy()
    environment["PYTHONIOENCODING"] = "utf-8"
    completed = subprocess.run(
        ["node", str(VISION), str(sheet), prompt(character, test)],
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
        parsed = extract_json(raw)
        missing = [code for code in CODES if code not in parsed.get("scores", {})]
        status = "ok" if not missing else "incomplete"
    except Exception as exc:
        parsed = {"scores": {}, "ranking": [], "reason": str(exc)}
        status = "error"
    result = {
        "character": character,
        "test": test,
        "seed": int(sheet.stem.rsplit("_seed-", 1)[1]),
        "sheet": str(sheet),
        "status": status,
        "review": parsed,
        "raw": raw,
    }
    write_json(report_path, result)
    return result


def number(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def average(values: list[float | None]) -> float:
    usable = [value for value in values if value is not None]
    return round(sum(usable) / len(usable), 3) if usable else 0.0


def aggregate(manifest: dict, reviews: list[dict]) -> dict:
    rows: dict[str, dict[str, list]] = {}
    critical: dict[str, list] = {}
    per_sheet = []
    for result in reviews:
        sheet_key = f"{result['test']}_seed-{result['seed']}"
        mapping = manifest["blind_mappings"][result["character"]][sheet_key]
        for code, version in mapping.items():
            score = result.get("review", {}).get("scores", {}).get(code, {})
            target = rows.setdefault(
                f"{result['character']}:{version}",
                {key: [] for key in ["identity_face", "hair_structure", "signature_accessories", "outfit_fidelity", "anatomy", "render_quality"]},
            )
            for key in target:
                target[key].append(number(score.get(key)))
            errors = score.get("critical_errors") or []
            critical.setdefault(f"{result['character']}:{version}", []).extend(errors)
            per_sheet.append({
                "character": result["character"],
                "test": result["test"],
                "seed": result["seed"],
                "code": code,
                "version": version,
                "scores": score,
            })
    scorecards = {}
    for key, axes in rows.items():
        means = {axis: average(values) for axis, values in axes.items()}
        signature = (means["hair_structure"] + means["signature_accessories"]) / 2
        quality = (means["anatomy"] + means["render_quality"]) / 2
        overall = 0.45 * means["identity_face"] + 0.25 * signature + 0.15 * means["outfit_fidelity"] + 0.15 * quality
        identity_values = [value for value in axes["identity_face"] if value is not None]
        signature_values = [
            (hair + accessory) / 2
            for hair, accessory in zip(axes["hair_structure"], axes["signature_accessories"], strict=True)
            if hair is not None and accessory is not None
        ]
        all_errors = critical.get(key, [])
        severe_errors = [
            error for error in all_errors
            if any(marker.lower() in str(error).lower() for marker in SEVERE_ERROR_MARKERS)
        ]
        hard_gate = (
            means["identity_face"] >= 8.5
            and sum(value >= 8 for value in signature_values) >= max(1, round(len(signature_values) * 0.75))
            and not severe_errors
        )
        scorecards[key] = {
            **means,
            "signature_mean": round(signature, 3),
            "quality_mean": round(quality, 3),
            "overall": round(overall, 3),
            "face_min": round(min(identity_values), 3) if identity_values else 0,
            "signature_pass_rate": round(sum(value >= 8 for value in signature_values) / len(signature_values), 3) if signature_values else 0,
            "reported_identity_errors": all_errors,
            "severe_identity_errors": severe_errors,
            "hard_gate_pass": hard_gate,
            "sample_count": len(identity_values),
        }
    rankings = {}
    for character in ["nene", "natsume"]:
        candidates = [(key.split(":", 1)[1], value) for key, value in scorecards.items() if key.startswith(character + ":")]
        candidates.sort(key=lambda item: (item[1]["hard_gate_pass"], item[1]["overall"], item[1]["identity_face"]), reverse=True)
        rankings[character] = [version for version, _ in candidates]
    return {"scorecards": scorecards, "rankings": rankings, "per_sheet": per_sheet}


def main() -> None:
    global OUTPUT
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--workers", type=int, default=2)
    args = parser.parse_args()
    OUTPUT = args.output.resolve()
    manifest = json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8"))
    sheets = []
    for character in ["nene", "natsume"]:
        for path in sorted((OUTPUT / character / "blinded_sheets").glob("*.jpg")):
            sheets.append((character, path))
    results = []
    with ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
        futures = {pool.submit(review_sheet, character, path): (character, path) for character, path in sheets}
        completed_count = 0
        for future in as_completed(futures):
            character, path = futures[future]
            completed_count += 1
            result = future.result()
            results.append(result)
            print(f"[{completed_count}/{len(sheets)}] {character} {path.stem}: {result['status']}", flush=True)
    result = aggregate(manifest, results)
    result["reviews"] = sorted(results, key=lambda item: (item["character"], item["test"], item["seed"]))
    write_json(OUTPUT / "scorecard.json", result)
    print(json.dumps(result["rankings"], ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
