"""Set the app's version everywhere it appears.

Usage: python3 tools/bump-version.py 0.9 "26 Nov 2026"

Updates version.json (which open copies of the app check to offer an update),
the number in js/app.js, and the ?v= on every script and stylesheet link, so a
phone fetches the new files instead of using the ones it saved.
"""
import json, re, sys, pathlib
version, built = sys.argv[1], sys.argv[2]
root = pathlib.Path(__file__).resolve().parent.parent
(root / "version.json").write_text(json.dumps({"version": version, "built": built}) + "\n", encoding="utf-8")
app = root / "js" / "app.js"
s = app.read_text(encoding="utf-8")
s = re.sub(r'var VERSION = "[^"]*", BUILT = "[^"]*";', 'var VERSION = "%s", BUILT = "%s";' % (version, built), s)
app.write_text(s, encoding="utf-8")
for page in root.glob("*.html"):
    h = page.read_text(encoding="utf-8")
    h = re.sub(r'((?:src|href)="(?:js|css|vendor)/[^"?]+\.(?:js|css))(?:\?v=[^"]*)?"', r'\1?v=%s"' % version, h)
    page.write_text(h, encoding="utf-8")
print("version", version, built)
