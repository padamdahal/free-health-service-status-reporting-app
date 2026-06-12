import http.server
import socketserver
import json
import urllib.request
import urllib.error

PORT = 5000
DIRECTORY = "src"
DHIS2_BASE_URL = "https://hmis.gov.np/hmisadditional"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path.startswith("/api/") or self.path.startswith("/hmisrest/"):
            self._proxy_request("GET")
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith("/api/") or self.path.startswith("/hmisrest/"):
            self._proxy_request("POST")
        elif self.path.startswith("/dhis-web-commons"):
            content_length = int(self.headers.get('Content-Length', 0))
            self.rfile.read(content_length)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({}).encode())
        else:
            content_length = int(self.headers.get('Content-Length', 0))
            self.rfile.read(content_length)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({}).encode())

    def do_PUT(self):
        if self.path.startswith("/api/") or self.path.startswith("/hmisrest/"):
            self._proxy_request("PUT")
        else:
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({}).encode())

    def _proxy_request(self, method):
        target_url = DHIS2_BASE_URL + self.path
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        proxy_headers = {}
        for key in ('Authorization', 'Content-Type', 'Accept'):
            if self.headers.get(key):
                proxy_headers[key] = self.headers.get(key)

        try:
            req = urllib.request.Request(
                target_url,
                data=body,
                headers=proxy_headers,
                method=method
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                response_body = resp.read()
                self.send_response(resp.status)
                content_type = resp.headers.get('Content-Type', 'application/json')
                self.send_header('Content-Type', content_type)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(response_body)
        except urllib.error.HTTPError as e:
            body = e.read()
            self.send_response(e.code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept')
        self.end_headers()

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving Free Health Portal at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
