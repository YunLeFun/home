#!/usr/bin/env python3
"""Loopback-only HA WebSocket fixture; no real devices or external services."""
import argparse
import base64
import datetime
import hashlib
import json
import socketserver
import struct
import threading


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, port):
        super().__init__(("127.0.0.1", port), Handler)
        self.mode = "off"
        self.temperature = 24.5
        self.clients = set()
        self.lock = threading.RLock()

    def entity(self):
        return {
            "entity_id": "climate.fixture_ac", "state": self.mode,
            "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "attributes": {
                "friendly_name": "联调空调（模拟 HA）", "temperature": self.temperature,
                "current_temperature": 27,
                "min_temp": 16, "max_temp": 32, "target_temp_step": 0.5,
                "hvac_modes": ["off", "cool", "heat", "dry"], "supported_features": 1,
            },
        }


class Handler(socketserver.BaseRequestHandler):
    def handle(self):
        self.send_lock = threading.Lock()
        self.subscription = None
        try:
            header = b""
            while b"\r\n\r\n" not in header:
                byte = self.request.recv(1)
                if not byte or len(header) > 16384:
                    return
                header += byte
            lines = header.decode("ascii").split("\r\n")
            if lines[0].split(" ")[1] != "/api/websocket":
                self.request.sendall(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
                return
            fields = dict(line.split(": ", 1) for line in lines[1:] if ": " in line)
            key = next(value for key, value in fields.items() if key.lower() == "sec-websocket-key")
            accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest())
            self.request.sendall(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + b"\r\n\r\n")
            self.send({"type": "auth_required", "ha_version": "fixture"})
            auth = self.receive()
            if auth.get("type") != "auth" or auth.get("access_token") != "home-test-token":
                self.send({"type": "auth_invalid", "message": "Invalid fixture credential"})
                return
            self.send({"type": "auth_ok", "ha_version": "fixture"})
            with self.server.lock:
                self.server.clients.add(self)
            while True:
                message = self.receive()
                kind, identifier = message.get("type"), message.get("id")
                response = None
                if kind == "ping":
                    self.send({"type": "pong", "id": identifier})
                    continue
                if kind == "subscribe_events":
                    if message.get("event_type") == "state_changed":
                        self.subscription = identifier
                elif kind == "get_config":
                    response = {"unit_system": {"temperature": "°C"}}
                elif kind == "get_states":
                    with self.server.lock:
                        response = [self.server.entity()]
                elif kind == "call_service":
                    if message.get("domain") != "climate" or message.get("target", {}).get("entity_id") != "climate.fixture_ac":
                        self.send({"type": "result", "id": identifier, "success": False, "error": {"code": "not_found"}})
                        continue
                    with self.server.lock:
                        data = message.get("service_data", {})
                        if message.get("service") == "set_hvac_mode":
                            self.server.mode = data["hvac_mode"]
                        elif message.get("service") == "set_temperature":
                            self.server.temperature = data["temperature"]
                self.send({"type": "result", "id": identifier, "success": True, "result": response})
                if kind == "call_service":
                    with self.server.lock:
                        entity = self.server.entity()
                        for client in list(self.server.clients):
                            if client.subscription is not None:
                                try:
                                    client.send({"type": "event", "id": client.subscription, "event": {
                                        "event_type": "state_changed", "data": {"entity_id": "climate.fixture_ac", "new_state": entity},
                                    }})
                                except OSError:
                                    pass
        except (OSError, EOFError, ValueError, KeyError, StopIteration):
            pass
        finally:
            with self.server.lock:
                self.server.clients.discard(self)

    def read_exact(self, length):
        result = b""
        while len(result) < length:
            data = self.request.recv(length - len(result))
            if not data:
                raise EOFError()
            result += data
        return result

    def receive(self):
        while True:
            first, second = self.read_exact(2)
            length = second & 127
            if length == 126:
                length = struct.unpack("!H", self.read_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self.read_exact(8))[0]
            if length > 1024 * 1024:
                raise ValueError("Oversized fixture frame")
            mask = self.read_exact(4) if second & 128 else None
            payload = self.read_exact(length)
            if mask:
                payload = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
            opcode = first & 15
            if opcode == 8:
                raise EOFError()
            if opcode == 9:
                self.frame(payload, opcode=10)
                continue
            if opcode == 1:
                return json.loads(payload)

    def frame(self, payload, opcode=1):
        length = len(payload)
        prefix = bytes([128 | opcode, length]) if length < 126 else bytes([128 | opcode, 126]) + struct.pack("!H", length)
        with self.send_lock:
            self.request.sendall(prefix + payload)

    def send(self, message):
        self.frame(json.dumps(message).encode())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=0)
    arguments = parser.parse_args()
    with Server(arguments.port) as server:
        print(server.server_address[1], flush=True)
        server.serve_forever()
