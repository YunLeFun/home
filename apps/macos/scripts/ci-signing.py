#!/usr/bin/env python3
"""Import a release identity into an ephemeral CI keychain; never log secrets."""
import base64
import json
import os
from pathlib import Path
import plistlib
import re
import secrets
import shlex
import shutil
import subprocess
import sys
import tempfile


def run(*args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        # CalledProcessError includes argv, which can contain a keychain password.
        raise RuntimeError(f"{Path(args[0]).name} {args[1]} failed ({result.returncode})")
    return result.stdout


def cleanup(directory):
    directory = Path(directory)
    state = directory / "search-list.json"
    if not state.exists():
        return
    original = json.loads(state.read_text())
    run("security", "list-keychains", "-d", "user", "-s", *original)
    keychain = directory / "signing.keychain-db"
    if keychain.exists():
        run("security", "delete-keychain", str(keychain))
    shutil.rmtree(directory)


def install():
    identity = os.environ.get("MACOS_SIGNING_IDENTITY", "")
    team = os.environ.get("MACOS_SIGNING_TEAM_ID", "")
    encoded = os.environ.get("MACOS_CERTIFICATE_P12_BASE64", "")
    certificate_password = os.environ.get("MACOS_CERTIFICATE_PASSWORD", "")
    if not (re.fullmatch(r"[A-Fa-f0-9]{40}", identity) and re.fullmatch(r"[A-Z0-9]{10}", team)
            and encoded and certificate_password):
        raise RuntimeError("Developer ID certificate secrets and identity/team variables are required")
    archive = base64.b64decode(encoded, validate=True)
    os.umask(0o077)
    directory = Path(tempfile.mkdtemp(prefix="macos-signing-", dir=os.environ["RUNNER_TEMP"]))
    keychain = directory / "signing.keychain-db"
    certificate = directory / "identity.p12"
    original = shlex.split(run("security", "list-keychains", "-d", "user"))
    (directory / "search-list.json").write_text(json.dumps(original))
    with open(os.environ["GITHUB_ENV"], "a") as output:
        output.write(f"MACOS_SIGNING_DIR={directory}\n")
    try:
        certificate.write_bytes(archive)
        keychain_password = secrets.token_urlsafe(48)
        run("security", "create-keychain", "-p", keychain_password, str(keychain))
        run("security", "set-keychain-settings", "-lut", "21600", str(keychain))
        run("security", "unlock-keychain", "-p", keychain_password, str(keychain))
        run("security", "import", str(certificate), "-k", str(keychain),
            "-P", certificate_password, "-t", "cert", "-f", "pkcs12", "-T", "/usr/bin/codesign")
        run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:",
            "-s", "-k", keychain_password, str(keychain))
        run("security", "list-keychains", "-d", "user", "-s", str(keychain), *original)
        identities = run("security", "find-identity", "-v", "-p", "codesigning", str(keychain))
        valid = re.findall(r'^\s*\d+\)\s+([A-F0-9]{40})\s+"([^"]+)"', identities, re.MULTILINE)
        if (len(valid) != 1 or valid[0][0] != identity.upper()
                or not valid[0][1].startswith("Developer ID Application:")):
            raise RuntimeError("The keychain must contain exactly the configured valid Developer ID identity")
        with open(os.environ["GITHUB_ENV"], "a") as output:
            output.write(f"CODE_SIGN_IDENTITY={identity}\nCODE_SIGN_KEYCHAIN={keychain}\n")
        print("Developer ID identity imported into temporary keychain")
    except Exception:
        cleanup(directory)
        raise
    finally:
        certificate.unlink(missing_ok=True)


def verify(app_path, bundle_id):
    team = os.environ.get("MACOS_SIGNING_TEAM_ID", "")
    if not re.fullmatch(r"[A-Z0-9]{10}", team) or not re.fullmatch(r"[a-zA-Z0-9.-]+", bundle_id):
        raise RuntimeError("Expected signing team and bundle identifier are required")
    app = Path(app_path)
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    if info["CFBundleIdentifier"] != bundle_id:
        raise RuntimeError("Unexpected app bundle identifier")
    requirement = (f'identifier "{bundle_id}" and anchor apple generic '
                   'and certificate leaf[field.1.2.840.113635.100.6.1.13] exists '
                   f'and certificate leaf[subject.OU] = "{team}"')
    run("codesign", "--verify", "--deep", "--strict", "-R=" + requirement, str(app))
    result = subprocess.run(["codesign", "-d", "-r-", str(app)], capture_output=True, text=True)
    designated = next((line for line in (result.stdout + result.stderr).splitlines()
                       if line.startswith("designated =>")), "")
    if result.returncode or not designated or "cdhash" in designated or team not in designated:
        raise RuntimeError("App lacks a stable Developer ID designated requirement")
    print(f"Verified Developer ID team {team}, bundle {bundle_id}, and stable code identity")


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["install"]:
            install()
        elif sys.argv[1:] == ["cleanup"]:
            if os.environ.get("MACOS_SIGNING_DIR"):
                cleanup(os.environ["MACOS_SIGNING_DIR"])
        elif len(sys.argv) == 4 and sys.argv[1] == "verify":
            verify(sys.argv[2], sys.argv[3])
        else:
            raise RuntimeError("Usage: ci-signing.py install | cleanup | verify APP BUNDLE_ID")
    except (RuntimeError, ValueError, OSError, KeyError) as error:
        print(f"Signing setup failed: {error}", file=sys.stderr)
        sys.exit(1)
