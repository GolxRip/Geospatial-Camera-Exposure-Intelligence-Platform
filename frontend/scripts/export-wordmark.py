#!/usr/bin/env python3
"""Exports the COBRA-WATCH wordmark (bone on transparent) from assets/logo/build_logo.py.

The mark and the wordmark are never redrawn by hand (FRONTEND_SPEC.md section 6.1). This script calls
build_logo.wordmark() itself, so the web app's wordmark is the same artwork as the banner and the logo lockups.

    python3 scripts/export-wordmark.py            write public/brand/cobra-wordmark.svg
    python3 scripts/export-wordmark.py --check    exit 1 if the file differs from what build_logo.py produces

Needs only the Python standard library.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_DIR = os.path.abspath(os.path.join(HERE, '..', '..', 'assets', 'logo'))
TARGET = os.path.abspath(os.path.join(HERE, '..', 'public', 'brand', 'cobra-wordmark.svg'))

sys.path.insert(0, LOGO_DIR)
import build_logo as bl  # noqa: E402  (module has no side effects on import)


def build() -> str:
    body, end = bl.wordmark(bl.BONE, 0, 0)
    width = math.ceil(end)
    return bl.svg_wrap(width, bl.H, body, 'COBRA-WATCH')


def main() -> int:
    svg = build()
    if '--check' in sys.argv:
        on_disk = open(TARGET, encoding='utf-8').read() if os.path.exists(TARGET) else ''
        if on_disk != svg:
            print('export-wordmark: public/brand/cobra-wordmark.svg differs from build_logo.py output. '
                  'Run `npm run sync:wordmark`.', file=sys.stderr)
            return 1
        print('export-wordmark: wordmark is up to date.')
        return 0
    os.makedirs(os.path.dirname(TARGET), exist_ok=True)
    with open(TARGET, 'w', encoding='utf-8', newline='\n') as f:
        f.write(svg)
    print('export-wordmark: wrote public/brand/cobra-wordmark.svg')
    return 0


if __name__ == '__main__':
    sys.exit(main())
