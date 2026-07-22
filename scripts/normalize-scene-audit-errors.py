"""Repair reports where a vision API error was parsed as a zero-score review."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ERROR_MARKERS = (
    "API 403",
    "Free quota exhausted",
    "识图失败",
    "璇嗗浘澶辫触",
    "鐠囧棗娴樻径杈Е",
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    changed = []
    for path in (args.output / "reports").glob("*.json"):
        report = json.loads(path.read_text(encoding="utf-8"))
        raw = str(report.get("vision_raw") or "")
        if not any(marker in raw for marker in ERROR_MARKERS):
            continue
        report["status"] = "error"
        report["review"] = {
            "verdict": "error",
            "reason": "视觉审核服务额度耗尽，尚未完成人工审核。",
            "gate_failures": ["vision_api_quota_exhausted"],
        }
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        temporary.replace(path)
        changed.append(report["scene_id"])
    print(json.dumps({"changed": len(changed), "scene_ids": changed}, ensure_ascii=False))


if __name__ == "__main__":
    main()
