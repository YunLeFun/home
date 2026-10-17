#!/usr/bin/env python3
"""Publish loopback A/AAAA + one Bonjour service, only on this Mac.

An A-only proxy registration can leave macOS dual-stack lookups waiting for
AAAA, even while `curl -4` works. Publish both localhost addresses explicitly.
launchd restarts this process if mDNSResponder disconnects after sleep.
"""
import ctypes as c
import select
import signal
import socket
import subprocess
import sys
import time

HOST = b"homeassistant.local."


def check():
    # A separate bounded process prevents a stuck system resolver from also
    # wedging the registration watchdog or the shell's status command.
    code = "import socket; a={i[4][0] for i in socket.getaddrinfo('homeassistant.local',8123,type=socket.SOCK_STREAM)}; raise SystemExit(0 if {'127.0.0.1','::1'} <= a else 1)"
    try:
        return subprocess.run([sys.executable, "-c", code], timeout=5,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
    except subprocess.TimeoutExpired:
        return False


def run():
    dns = c.CDLL("/usr/lib/libSystem.B.dylib")
    ref, record = c.c_void_p, c.c_void_p
    u32, u16, i32 = c.c_uint32, c.c_uint16, c.c_int32
    record_reply = c.CFUNCTYPE(None, ref, record, u32, i32, ref)
    service_reply = c.CFUNCTYPE(None, ref, u32, i32, c.c_char_p, c.c_char_p, c.c_char_p, ref)
    dns.DNSServiceCreateConnection.argtypes = [c.POINTER(ref)]
    dns.DNSServiceRegisterRecord.argtypes = [ref, c.POINTER(record), u32, u32, c.c_char_p, u16, u16, u16, ref, u32, record_reply, ref]
    dns.DNSServiceRegister.argtypes = [c.POINTER(ref), u32, u32, c.c_char_p, c.c_char_p, c.c_char_p, c.c_char_p, u16, u16, ref, service_reply, ref]
    dns.DNSServiceRefSockFD.argtypes = [ref]
    dns.DNSServiceProcessResult.argtypes = [ref]
    dns.DNSServiceRefDeallocate.argtypes = [ref]
    dns.DNSServiceRefDeallocate.restype = None
    errors = []

    @record_reply
    def on_record(_ref, _record, _flags, error, _context):
        if error:
            errors.append(error)

    @service_reply
    def on_service(_ref, _flags, error, _name, _type, _domain, _context):
        if error:
            errors.append(error)

    def require(result):
        if result:
            raise RuntimeError("DNS-SD error %s" % result)

    records, service = ref(), ref()
    try:
        require(dns.DNSServiceCreateConnection(c.byref(records)))
        # kDNSServiceFlagsUnique = 0x20; LocalOnly = (uint32_t)-1.
        for family, address, rrtype in [(socket.AF_INET, "127.0.0.1", 1), (socket.AF_INET6, "::1", 28)]:
            data = c.create_string_buffer(socket.inet_pton(family, address))
            handle = record()
            require(dns.DNSServiceRegisterRecord(records, c.byref(handle), 0x20, 0xffffffff,
                                                HOST, rrtype, 1, c.sizeof(data) - 1, data, 240, on_record, None))
        txt = b"internal_url=http://127.0.0.1:8123"
        txt = bytes([len(txt)]) + txt
        txt_buffer = c.create_string_buffer(txt)
        require(dns.DNSServiceRegister(c.byref(service), 0, 0xffffffff, b"Yun Home HA (This Mac)",
                                      b"_home-assistant._tcp", b"local.", HOST, socket.htons(8123),
                                      len(txt), txt_buffer, on_service, None))
        descriptors = {dns.DNSServiceRefSockFD(value): value for value in [records, service]}
        next_check = time.monotonic() + 15
        print("Registered LocalOnly homeassistant.local: 127.0.0.1 and ::1", flush=True)
        while True:
            ready, _, _ = select.select(list(descriptors), [], [], 5)
            for descriptor in ready:
                require(dns.DNSServiceProcessResult(descriptors[descriptor]))
            if errors:
                raise RuntimeError("DNS-SD callback error %s" % errors[0])
            if time.monotonic() >= next_check:
                if not check():
                    raise RuntimeError("Loopback DNS lookup failed; re-registering through launchd")
                next_check = time.monotonic() + 30
    finally:
        for value in [service, records]:
            if value:
                dns.DNSServiceRefDeallocate(value)


if __name__ == "__main__":
    if "--check" in sys.argv:
        raise SystemExit(0 if check() else 1)
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    try:
        run()
    except (RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr, flush=True)
        raise SystemExit(1)
