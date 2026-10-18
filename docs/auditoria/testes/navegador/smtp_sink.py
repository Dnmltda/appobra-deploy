"""Servidor SMTP mínimo para testes: aceita qualquer mensagem e grava em OUT_DIR."""
import os
import socketserver
import sys
import time

OUT_DIR = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 2525
os.makedirs(OUT_DIR, exist_ok=True)


class Handler(socketserver.StreamRequestHandler):
    def send(self, line):
        self.wfile.write((line + "\r\n").encode())

    def handle(self):
        self.send("220 sink")
        data_mode, buf = False, []
        while True:
            line = self.rfile.readline()
            if not line:
                return
            text = line.decode(errors="replace").rstrip("\r\n")
            if data_mode:
                if text == ".":
                    data_mode = False
                    with open(os.path.join(OUT_DIR, f"{time.time():.6f}.eml"), "w") as f:
                        f.write("\n".join(buf))
                    buf = []
                    self.send("250 ok")
                else:
                    buf.append(text[1:] if text.startswith("..") else text)
                continue
            cmd = text.split(" ")[0].upper()
            if cmd in ("EHLO", "HELO"):
                self.send("250 sink")
            elif cmd == "DATA":
                data_mode = True
                self.send("354 go")
            elif cmd == "QUIT":
                self.send("221 bye")
                return
            else:
                self.send("250 ok")


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


Server(("127.0.0.1", PORT), Handler).serve_forever()
