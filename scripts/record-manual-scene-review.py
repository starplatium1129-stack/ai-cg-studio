"""Record resumable direct-vision scene audit decisions."""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_failure(value: str) -> tuple[str, str]:
    scene_id, separator, reason = value.partition("=")
    if not separator or not scene_id or not reason:
        raise argparse.ArgumentTypeError("failure must use scene_id=reason")
    return scene_id, reason


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--audit", type=Path, required=True)
    parser.add_argument("--pass-ids", default="")
    parser.add_argument("--fail", action="append", default=[], type=parse_failure)
    parser.add_argument("--attempt", type=int, default=1)
    args = parser.parse_args()

    path = args.audit / "manual-review.json"
    records = {}
    if path.exists():
        records = json.loads(path.read_text(encoding="utf-8")).get("records", {})

    timestamp = datetime.now(timezone.utc).isoformat()
    passed = [value.strip() for value in args.pass_ids.split(",") if value.strip()]
    for scene_id in passed:
        records[scene_id] = {
            "scene_id": scene_id,
            "attempt": args.attempt,
            "verdict": "pass",
            "reason": "人物身份、画面质量与故事核心事件经直接视觉复核均达到纳入标准。",
            "reviewer": "codex_direct_vision",
            "reviewed_at": timestamp,
        }
    for scene_id, reason in args.fail:
        records[scene_id] = {
            "scene_id": scene_id,
            "attempt": args.attempt,
            "verdict": "fail",
            "reason": reason,
            "reviewer": "codex_direct_vision",
            "reviewed_at": timestamp,
        }

    ordered = dict(sorted(records.items()))
    summary = {
        "total": len(ordered),
        "passed": sum(item["verdict"] == "pass" for item in ordered.values()),
        "failed": sum(item["verdict"] == "fail" for item in ordered.values()),
    }
    payload = {"summary": summary, "records": ordered}
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
