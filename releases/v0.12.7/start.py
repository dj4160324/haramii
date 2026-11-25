#!/usr/bin/env python3
"""Local-only static server. Python standard library; no OR-Tools install needed."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from pathlib import Path
import argparse,webbrowser
root=Path(__file__).resolve().parent/"dist"
class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript','.wasm':'application/wasm'}
    def __init__(self,*a,**kw):super().__init__(*a,directory=str(root),**kw)
    def do_GET(self):
        if not self.allowed():self.send_error(404);return
        super().do_GET()
    def do_HEAD(self):
        if not self.allowed():self.send_error(404);return
        super().do_HEAD()
    def allowed(self):
        from urllib.parse import urlsplit,unquote
        path=unquote(urlsplit(self.path).path)
        return path in ['/','/index.html','/isolation-bootstrap.js','/isolation-sw.js','/qa/runtime-check.html','/qa/synthetic-gate.json'] or (path.startswith('/assets/') and '..' not in path and '\\' not in path)
    def list_directory(self,path):self.send_error(404);return None
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin');self.send_header('Cross-Origin-Embedder-Policy','require-corp');self.send_header('Cross-Origin-Resource-Policy','same-origin');self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');super().end_headers()
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);p.add_argument('--no-open',action='store_true');a=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',a.port),Handler)
    url=f'http://127.0.0.1:{server.server_port}/';print('Haramii: '+url,flush=True)
    if not a.no_open:webbrowser.open(url)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
