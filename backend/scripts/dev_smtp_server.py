#!/usr/bin/env python3
"""A tiny local SMTP server for testing PlaceMatrix emails without a real mail account.

It accepts every message, prints a summary and saves each email as an .eml file you can open
in any mail client. Nothing is delivered to the internet.

    python scripts/dev_smtp_server.py                 # listens on 127.0.0.1:1025, saves to ./sent_emails
    python scripts/dev_smtp_server.py --port 2525 --out mails
    python scripts/dev_smtp_server.py --reject-auth   # simulate a wrong SMTP password

Point the backend at it in backend/.env, then restart the backend:
    SMTP_HOST=127.0.0.1
    SMTP_PORT=1025
    SMTP_SECURITY=none
    SMTP_USERNAME=test          (any value; or leave empty)
    SMTP_PASSWORD=test
    SMTP_FROM_EMAIL=cdpc@iitrpr.ac.in
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import email
import email.policy
import sys
import time
from pathlib import Path


class Session:
    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter, out: Path, reject_auth: bool):
        self.r, self.w, self.out, self.reject_auth = reader, writer, out, reject_auth
        self.mail_from: str | None = None
        self.rcpts: list[str] = []

    async def send(self, line: str) -> None:
        self.w.write((line + "\r\n").encode())
        await self.w.drain()

    async def readline(self) -> str:
        data = await self.r.readline()
        if not data:
            raise ConnectionResetError
        return data.decode("utf-8", "replace").rstrip("\r\n")

    async def run(self) -> None:
        await self.send("220 placematrix-dev-smtp ready")
        while True:
            line = await self.readline()
            cmd, _, arg = line.partition(" ")
            cmd = cmd.upper()
            if cmd in ("EHLO", "HELO"):
                if cmd == "EHLO":
                    self.w.write(b"250-placematrix-dev-smtp\r\n250-AUTH PLAIN LOGIN\r\n250-8BITMIME\r\n250 SIZE 26214400\r\n")
                    await self.w.drain()
                else:
                    await self.send("250 placematrix-dev-smtp")
            elif cmd == "AUTH":
                mech, _, initial = arg.partition(" ")
                if mech.upper() == "LOGIN":
                    await self.send("334 VXNlcm5hbWU6")
                    await self.readline()
                    await self.send("334 UGFzc3dvcmQ6")
                    await self.readline()
                elif mech.upper() == "PLAIN" and not initial:
                    await self.send("334 ")
                    await self.readline()
                if self.reject_auth:
                    await self.send("535 5.7.8 Username and Password not accepted (simulated)")
                else:
                    await self.send("235 2.7.0 Authentication successful")
            elif cmd == "MAIL":
                self.mail_from, self.rcpts = arg.split(":", 1)[-1].strip(" <>"), []
                await self.send("250 OK")
            elif cmd == "RCPT":
                self.rcpts.append(arg.split(":", 1)[-1].strip(" <>"))
                await self.send("250 OK")
            elif cmd == "DATA":
                await self.send("354 End data with <CR><LF>.<CR><LF>")
                lines = []
                while True:
                    raw = await self.r.readline()
                    if raw in (b".\r\n", b".\n", b""):
                        break
                    lines.append(raw[1:] if raw.startswith(b"..") else raw)
                self.save(b"".join(lines))
                await self.send("250 OK: queued")
            elif cmd == "RSET":
                self.mail_from, self.rcpts = None, []
                await self.send("250 OK")
            elif cmd == "NOOP":
                await self.send("250 OK")
            elif cmd == "QUIT":
                await self.send("221 Bye")
                break
            else:
                await self.send("502 Command not implemented")

    def save(self, data: bytes) -> None:
        msg = email.message_from_bytes(data, policy=email.policy.default)
        self.out.mkdir(parents=True, exist_ok=True)
        name = f"{time.strftime('%Y%m%d-%H%M%S')}-{abs(hash(data)) % 10**6:06d}.eml"
        (self.out / name).write_bytes(data)
        print(f"[mail] to={', '.join(self.rcpts)} subject={msg['Subject']!r} -> {self.out / name}", flush=True)


async def main() -> None:
    # Windows consoles (cp1252) cannot print every character in a subject; never let logging break delivery.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    p =argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=1025)
    p.add_argument("--out", default="sent_emails", help="folder for received .eml files")
    p.add_argument("--reject-auth", action="store_true", help="answer every login with 535 (test error handling)")
    a = p.parse_args()
    out = Path(a.out)

    async def handle(reader, writer):
        try:
            await Session(reader, writer, out, a.reject_auth).run()
        except (ConnectionResetError, asyncio.IncompleteReadError):
            pass
        finally:
            writer.close()

    server = await asyncio.start_server(handle, a.host, a.port)
    print(f"PlaceMatrix dev SMTP server on {a.host}:{a.port} — saving emails to {out.resolve()}"
          + (" (rejecting logins)" if a.reject_auth else ""), flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
