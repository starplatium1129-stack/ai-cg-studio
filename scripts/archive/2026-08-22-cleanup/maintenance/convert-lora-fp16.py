"""Convert a safetensors LoRA to fp16 while preserving metadata."""

from __future__ import annotations

import argparse
from pathlib import Path

import torch
from safetensors import safe_open
from safetensors.torch import load_file, save_file


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    args = parser.parse_args()
    source = args.source.resolve()
    target = args.target.resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if target.exists():
        raise FileExistsError(f"refusing to overwrite: {target}")

    with safe_open(source, framework="pt", device="cpu") as handle:
        metadata = handle.metadata()
    tensors = load_file(source, device="cpu")
    converted = {
        key: value.to(torch.float16) if value.is_floating_point() else value
        for key, value in tensors.items()
    }
    target.parent.mkdir(parents=True, exist_ok=True)
    save_file(converted, target, metadata=metadata)
    print(f"{source.stat().st_size} -> {target.stat().st_size} bytes: {target}")


if __name__ == "__main__":
    main()
