#!/usr/bin/env python3
"""Stamp every ?v= in every page (stylesheets and import maps) with one value.

Usage: python3 bump-version.py [stamp]   (default: today's date + next letter)

Every page shares site.css and the modules, so they all take the same stamp:
a page left on an old stamp can run a new module against an old config.
"""
import re, sys, datetime, pathlib

here = pathlib.Path(__file__).parent
pages = sorted(here.glob("*.html"))
old = [m for p in pages for m in re.findall(r"\?v=(\d{8})([a-z])", p.read_text())]
today = datetime.date.today().strftime("%Y%m%d")
if len(sys.argv) > 1:
    stamp = sys.argv[1]
else:
    n = max((ord(l) - 96 for d, l in old if d == today), default=0) + 1
    stamp = today + chr(96 + n)
for p in pages:
    p.write_text(re.sub(r"\?v=\d{8}[a-z]", "?v=" + stamp, p.read_text()))
print("stamped", stamp, "in", ", ".join(p.name for p in pages))
