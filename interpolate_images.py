#!/usr/bin/env python3
"""
interpolate_images.py

Takes two PNG images and generates a deterministic sequence of "in-between"
images by linearly interpolating each pixel's color from the first (before)
image to the second (after) image.

For pixel colors before=(r0,g0,b0,a0) and after=(r1,g1,b1,a1), the i-th
intermediary image (i = 1..N) uses parameter:

    t = i / (N + 1)

and computes each channel as:

    value(t) = before + t * (after - before)

which is the same formula for every pixel, applied independently per channel,
so the whole process is fully deterministic (same inputs -> same outputs).

Usage:
    python interpolate_images.py before.png after.png N [--output-dir DIR] [--prefix NAME]

Example:
    python interpolate_images.py start.png end.png 5
    -> creates 5 images: frame_1.png ... frame_5.png, evenly spaced between
       start.png (exclusive) and end.png (exclusive).
"""

import argparse
import os
import sys

import numpy as np
from PIL import Image


def load_as_rgba_array(path: str) -> np.ndarray:
    """Load a PNG as an RGBA numpy array of dtype float64 (for precise interpolation)."""
    img = Image.open(path).convert("RGBA")
    return np.array(img, dtype=np.float64)


def interpolate(
    before_path: str,
    after_path: str,
    num_intermediaries: int,
    output_dir: str = "frames",
    prefix: str = "frame",
) -> list:
    """
    Generate `num_intermediaries` deterministic in-between images between
    before_path and after_path.

    Returns the list of output file paths written.
    """
    if num_intermediaries < 1:
        raise ValueError("num_intermediaries must be at least 1")

    before_arr = load_as_rgba_array(before_path)
    after_arr = load_as_rgba_array(after_path)

    if before_arr.shape != after_arr.shape:
        # Resize the "after" image to match "before" so pixels line up 1:1.
        after_img = Image.open(after_path).convert("RGBA")
        after_img = after_img.resize(
            (before_arr.shape[1], before_arr.shape[0]), Image.LANCZOS
        )
        after_arr = np.array(after_img, dtype=np.float64)

    os.makedirs(output_dir, exist_ok=True)

    delta = after_arr - before_arr
    out_paths = []

    for i in range(1, num_intermediaries + 1):
        t = i / (num_intermediaries + 1)  # strictly between 0 and 1
        frame = before_arr + t * delta
        frame = np.clip(np.round(frame), 0, 255).astype(np.uint8)

        out_img = Image.fromarray(frame, mode="RGBA")
        out_path = os.path.join(output_dir, f"{prefix}_{i}.png")
        out_img.save(out_path)
        out_paths.append(out_path)

    return out_paths


def main():
    parser = argparse.ArgumentParser(
        description="Generate deterministic in-between PNG images by "
        "linearly interpolating pixel colors between two images."
    )
    parser.add_argument("before", help="Path to the starting PNG image")
    parser.add_argument("after", help="Path to the ending PNG image")
    parser.add_argument(
        "num_intermediaries",
        type=int,
        help="Number of intermediary images to generate",
    )
    parser.add_argument(
        "--output-dir",
        default="frames",
        help="Directory to write the generated frames to (default: ./frames)",
    )
    parser.add_argument(
        "--prefix",
        default="frame",
        help="Filename prefix for generated frames (default: 'frame')",
    )

    args = parser.parse_args()

    try:
        paths = interpolate(
            args.before,
            args.after,
            args.num_intermediaries,
            output_dir=args.output_dir,
            prefix=args.prefix,
        )
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Wrote {len(paths)} image(s) to '{args.output_dir}':")
    for p in paths:
        print(f"  {p}")


if __name__ == "__main__":
    main()