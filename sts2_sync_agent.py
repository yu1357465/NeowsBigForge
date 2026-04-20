# ================= 文件名：sts2_sync_agent.py =================
import http.server
import socketserver
import os
import sys

PORT = 12026

# 【核心修复】：获取脚本所在的绝对目录，彻底解决计划任务的工作目录漂移问题
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TARGET_FILE = os.path.join(SCRIPT_DIR, 'current_run.save')

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_GET(self):
        if self.path == '/ping':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"pong")
            return

        if self.path == '/current_run':
            if os.path.exists(TARGET_FILE):
                try:
                    with open(TARGET_FILE, 'r', encoding='utf-8') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(data.encode('utf-8'))
                except Exception as e:
                    self.send_error(500, f"File read error: {str(e)}")
            else:
                # 报错时精准打印它到底在哪个路径找文件，方便排错
                self.send_error(404, f"File not found exactly at: {TARGET_FILE}")
            return

        self.send_error(404, "Invalid endpoint")

if __name__ == "__main__":
    # 为了防止计划任务运行时端口被之前残留的进程占用，设置端口复用
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("127.0.0.1", PORT), CORSRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass