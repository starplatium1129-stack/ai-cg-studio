"""Summarize scene audit score distributions and near-pass candidates."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


AXES = [
    "identity_face", "signature_features", "story_match", "outfit_match",
    "composition", "anatomy", "render_quality", "official_cg_closeness",
]
GATES = {
    "identity_face": 9.0,
    "signature_features": 8.8,
    "story_match": 8.8,
    "outfit_match": 8.5,
    "anatomy": 8.0,
    "render_quality": 8.5,
}


def number(value: object) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = round((len(ordered) - 1) * fraction)
    return round(ordered[index], 3)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    reports = []
    for path in (args.output / "reports").glob("*.json"):
        reports.append(json.loads(path.read_text(encoding="utf-8")))

    latest = {}
    for report in reports:
        current = latest.get(report["scene_id"])
        if current is None or int(report.get("attempt", 0)) > int(current.get("attempt", 0)):
            latest[report["scene_id"]] = report

    rows = []
    errors = []
    gate_counts = Counter()
    critical_counts = Counter()
    for report in latest.values():
        review = report.get("review", {})
        if report.get("status") == "error" or review.get("verdict") == "error":
            errors.append({
                "scene_id": report["scene_id"],
                "title": report.get("title"),
                "character": report.get("character"),
                "rating": report.get("rating"),
                "attempt": report.get("attempt"),
                "reason": review.get("reason"),
                "gate_failures": review.get("gate_failures") or [],
            })
            continue
        deficits = {
            key: round(max(0.0, minimum - number(review.get(key))), 3)
            for key, minimum in GATES.items()
        }
        failures = [key for key, deficit in deficits.items() if deficit > 0]
        gate_counts.update(failures)
        critical = review.get("critical_errors") or []
        for error in critical:
            critical_counts[str(error)] += 1
        rows.append({
            "scene_id": report["scene_id"],
            "title": report.get("title"),
            "character": report.get("character"),
            "rating": report.get("rating"),
            "attempt": report.get("attempt"),
            "scores": {key: number(review.get(key)) for key in AXES},
            "deficits": deficits,
            "failed_gates": failures,
            "critical_errors": critical,
            "total_deficit": round(sum(deficits.values()) + 2.0 * bool(critical), 3),
            "reason": review.get("reason"),
            "prompt_fix": review.get("prompt_fix"),
        })
    rows.sort(key=lambda item: (item["total_deficit"], -item["scores"]["official_cg_closeness"]))

    distribution = {}
    for axis in AXES:
        values = [row["scores"][axis] for row in rows]
        distribution[axis] = {
            "mean": round(sum(values) / len(values), 3) if values else 0.0,
            "p25": percentile(values, 0.25),
            "median": percentile(values, 0.5),
            "p75": percentile(values, 0.75),
            "max": max(values, default=0.0),
        }
    summary = {
        "total": len(latest),
        "reviewed_count": len(rows),
        "unreviewed_count": len(errors),
        "distribution": distribution,
        "gate_failure_counts": dict(gate_counts.most_common()),
        "critical_error_count": sum(bool(row["critical_errors"]) for row in rows),
        "common_critical_errors": critical_counts.most_common(30),
        "near_pass_count": sum(row["total_deficit"] <= 0.6 and not row["critical_errors"] for row in rows),
        "top_near_pass": rows[:40],
        "rows": rows,
        "unreviewed": sorted(errors, key=lambda item: item["scene_id"]),
    }
    target = args.output / "analysis.json"
    target.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({key: summary[key] for key in ["total", "reviewed_count", "unreviewed_count", "distribution", "gate_failure_counts", "critical_error_count", "near_pass_count"]}, ensure_ascii=False, indent=2))
    print("top:", ", ".join(row["scene_id"] for row in rows[:20]))


if __name__ == "__main__":
    main()
