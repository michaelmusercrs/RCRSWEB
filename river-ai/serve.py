import http.server
import socketserver
import os

PORT = 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"River chat server: http://localhost:{PORT}/river-chat.html")
with socketserver.TCPServer(("0.0.0.0", PORT), http.server.SimpleHTTPRequestHandler) as s:
    s.serve_forever()
