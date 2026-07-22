"""GOV-1544 — loopback SMTP sink for the local e2e magic-link leg.

Stdlib-only debug sink: binds 127.0.0.1 on a free port, prints the port on
stdout (the e2e script captures it), and writes every accepted message to
``--out-dir`` as ``msg-<n>.eml``. Speaks just enough RFC-5321 for smtplib.
No auth, no TLS — the SmtpAdapter side runs with GW_SMTP_SECURITY=none, which
the adapter only permits toward loopback hosts. Nothing here ever leaves the
machine; this is the "no real provider before P3d" rule made runnable.
"""

from __future__ import annotations

import argparse
import socketserver
import sys
from pathlib import Path


class _Handler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        def reply(line: str) -> None:
            self.wfile.write((line + "\r\n").encode("ascii"))

        reply("220 gov1544 sink ready")
        while True:
            raw = self.rfile.readline()
            if not raw:
                return
            upper = raw.decode("ascii", "replace").strip().upper()
            if upper.startswith(("EHLO", "HELO")):
                reply("250 sink")
            elif upper.startswith(("MAIL FROM", "RCPT TO")):
                reply("250 ok")
            elif upper.startswith("DATA"):
                reply("354 go")
                lines = []
                while True:
                    body_line = self.rfile.readline()
                    if not body_line or body_line in (b".\r\n", b".\n"):
                        break
                    lines.append(body_line)
                out_dir: Path = self.server.out_dir  # type: ignore[attr-defined]
                self.server.count += 1  # type: ignore[attr-defined]
                target = out_dir / f"msg-{self.server.count}.eml"  # type: ignore[attr-defined]
                target.write_bytes(b"".join(lines))
                reply("250 accepted")
            elif upper.startswith("QUIT"):
                reply("221 bye")
                return
            else:
                reply("502 not implemented")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    server = socketserver.ThreadingTCPServer(("127.0.0.1", 0), _Handler)
    server.out_dir = args.out_dir  # type: ignore[attr-defined]
    server.count = 0  # type: ignore[attr-defined]
    print(server.server_address[1], flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
