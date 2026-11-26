"""
Serve kiln/ locally with caching switched off.

    python3 serve.py            # http://localhost:5500
    python3 serve.py 8000       # another port

Why not plain `python3 -m http.server`: it sends Last-Modified but no
Cache-Control, so browsers may reuse a cached ES module without asking.
After an edit you can then end up running a NEW views/intro.js against an
OLD config.js — e.g. PALETTE.yard is undefined, `new THREE.Color(undefined)`
silently stays white, and the intro backdrop turns white with no error.
`no-store` makes every load fetch every file fresh; on a local machine the
cost is nothing.
"""
import functools
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'kiln')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.glb': 'model/gltf-binary',
        '.webp': 'image/webp',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    handler = functools.partial(NoCacheHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(('', PORT), handler) as httpd:
        print(f'serving {ROOT} at http://localhost:{PORT} (no-store)', flush=True)
        httpd.serve_forever()
