#!/usr/bin/env python3
"""Translate short Chinese story/dialogue text to Japanese with a local CPU model."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MODEL = REPO_ROOT.parent / "AI" / "Voice" / "models" / "translation" / "m2m100_418m"
MODEL_PATH = Path(os.environ.get("AICS_TRANSLATION_MODEL", DEFAULT_MODEL))
MAX_INPUT_CHARS = 2000


def fail(message: str, code: int = 1) -> int:
    print(json.dumps({"error": message}, ensure_ascii=False))
    return code


def segments(text: str) -> list[str]:
    """Keep dialogue punctuation while staying comfortably below Marian's input limit."""
    parts = re.split(r"(?<=[。！？!?；;\n])", text.strip())
    result: list[str] = []
    for part in parts:
        part = part.strip()
        while len(part) > 240:
            split_at = max(part.rfind(mark, 0, 240) for mark in "，,、 ")
            split_at = split_at if split_at > 24 else 240
            result.append(part[:split_at + 1].strip())
            part = part[split_at + 1:].strip()
        if part:
            result.append(part)
    return result or [text.strip()]


def normalize_japanese(text: str) -> str:
    text = re.sub(r"\s+([、。！？])", r"\1", text)
    text = re.sub(r"([「『（])\s+", r"\1", text)
    text = re.sub(r"\s+([」』）])", r"\1", text)
    return text.strip()


def translate(text: str) -> list[dict[str, str]]:
    if not MODEL_PATH.is_dir():
        raise RuntimeError("本地中日翻译模型尚未安装；请先运行 tools\\install-translation-model.ps1。")
    torch.set_num_threads(max(1, min(8, os.cpu_count() or 4)))
    tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_PATH, local_files_only=True)
    model.eval()
    if hasattr(tokenizer, "src_lang"):
        tokenizer.src_lang = "zh"
    output: list[dict[str, str]] = []
    with torch.inference_mode():
        for part in segments(text):
            encoded = tokenizer(part, return_tensors="pt", truncation=True, max_length=384)
            options = {"max_new_tokens": 384, "num_beams": 4, "early_stopping": True}
            if hasattr(tokenizer, "get_lang_id"):
                options["forced_bos_token_id"] = tokenizer.get_lang_id("ja")
            generated = model.generate(**encoded, **options)
            output.append({"source": part, "translation": normalize_japanese(tokenizer.decode(generated[0], skip_special_tokens=True))})
    return output


def main() -> int:
    try:
        request = json.loads(sys.stdin.read() or "{}")
        text = str(request.get("text") or "").strip()
    except json.JSONDecodeError:
        return fail("翻译请求格式无效。")
    if not text or len(text) > MAX_INPUT_CHARS:
        return fail("待翻译中文需在 1—2000 字之间。")
    try:
        translated = translate(text)
        print(json.dumps({"translation": "\n".join(item["translation"] for item in translated), "segments": translated}, ensure_ascii=False))
        return 0
    except Exception as error:
        return fail(str(error))


if __name__ == "__main__":
    raise SystemExit(main())
