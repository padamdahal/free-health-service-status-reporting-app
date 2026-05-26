import http.server
import socketserver
import os

PORT = 5000
DIRECTORY = "src"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving Free Health Portal at http://0.0.0.0:{PORT}")
    httpd.serve_forever()
