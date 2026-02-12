import http.server
import socketserver
import threading
import webbrowser
import os
import sys

PORT = 8090
DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(DIR)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress console spam

def start_server():
    with socketserver.TCPServer(("0.0.0.0", PORT), QuietHandler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    print("=" * 45)
    print("  RIVER - River City Roofing AI Assistant")
    print("=" * 45)
    print()
    print(f"  Chat: http://localhost:{PORT}/river-chat.html")
    print()
    print("  Keep this window open while using River.")
    print("  Press Ctrl+C to stop.")
    print()

    t = threading.Thread(target=start_server, daemon=True)
    t.start()

    webbrowser.open(f"http://localhost:{PORT}/river-chat.html")

    try:
        t.join()
    except KeyboardInterrupt:
        print("\nRiver stopped.")
        sys.exit(0)
