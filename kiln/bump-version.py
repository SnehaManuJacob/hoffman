#!/usr/bin/env python3
"""Stamp every ?v= in index.html (stylesheet and import map) with one value.

Usage: python3 bump-version.py [stamp]   (default: today's date + next letter)
"""
import re, sys, datetime, pathlib

p = pathlib.Path(__file__).with_name("index.html")
h = p.read_text()
old = re.findall(r"\?v=(\d{8})([a-z])", h)
today = datetime.date.today().strftime("%Y%m%d")
if len(sys.argv) > 1:
    stamp = sys.argv[1]
else:
    n = max((ord(l) - 96 for d, l in old if d == today), default=0) + 1
    stamp = today + chr(96 + n)
p.write_text(re.sub(r"\?v=\d{8}[a-z]", "?v=" + stamp, h))
print("stamped", stamp)
