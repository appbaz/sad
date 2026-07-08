#!/usr/bin/env python3
"""Generate favicon and PWA icons from icons/icon.svg."""

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "icons"
SVG = ICONS / "icon.svg"

SIZES = {
    "favicon-16.png": 16,
    "favicon-32.png": 32,
    "icon-192.png": 192,
    "icon-512.png": 512,
}


def render_png(name: str, size: int) -> None:
    out = ICONS / name
    subprocess.run(
        [
            "convert",
            "-background",
            "none",
            str(SVG),
            "-resize",
            f"{size}x{size}",
            str(out),
        ],
        check=True,
    )
    print(f"wrote {out} ({size}x{size})")


def main() -> None:
    if not SVG.exists():
        raise SystemExit(f"Missing source icon: {SVG}")

    for name, size in SIZES.items():
        render_png(name, size)

    ico_path = ICONS / "favicon.ico"
    subprocess.run(
        [
            "convert",
            str(ICONS / "favicon-16.png"),
            str(ICONS / "favicon-32.png"),
            str(ico_path),
        ],
        check=True,
    )
    print(f"wrote {ico_path}")


if __name__ == "__main__":
    main()
