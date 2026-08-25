"""Deterministic same-seed image A/B metrics for the SageAttention rollout check.

Compares two same-seed renders (sage off vs on) with PSNR and mean-abs-diff,
plus per-channel stats, so the "no visible quality loss" claim does not rely
on eyeballing alone. Run with the ComfyUI venv python (numpy + PIL available).
"""
import sys

import numpy as np
from PIL import Image


def load(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)


def psnr(a, b):
    mse = np.mean((a - b) ** 2)
    if mse == 0:
        return float("inf")
    return 10.0 * np.log10(255.0 ** 2 / mse)


def main():
    if len(sys.argv) != 3:
        print("usage: compare-sage-ab.py <baseline.png> <sage.png>")
        return 1
    a, b = load(sys.argv[1]), load(sys.argv[2])
    if a.shape != b.shape:
        print(f"shape mismatch: {a.shape} vs {b.shape}")
        return 1
    diff = np.abs(a - b)
    print(f"resolution: {a.shape[1]}x{a.shape[0]}")
    print(f"PSNR: {psnr(a, b):.2f} dB")
    print(f"mean abs diff: {diff.mean():.3f} / 255")
    print(f"max abs diff: {diff.max():.0f} / 255")
    print(f"pixels with diff > 8: {(diff.max(axis=2) > 8).mean() * 100:.3f}%")
    print(f"pixels with diff > 16: {(diff.max(axis=2) > 16).mean() * 100:.3f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
