#!/usr/bin/env python3
"""
Repackages the compiled Vite web bundle (./dist) into public/bmw728li-idrive.apk,
preserves the Android native shell (AndroidManifest.xml, classes.dex, resources.arsc, res/),
applies 4-byte zipalign on stored entries, and signs with both APK Signature Scheme v1 (JAR)
and APK Signature Scheme v2 (APK Sig Block 42, RSA-2048 SHA-256).
"""

import base64
import hashlib
import os
import shutil
import struct
import subprocess
import tempfile
import zipfile
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST_DIR = ROOT / "dist"
PUBLIC_APK = ROOT / "public" / "bmw728li-idrive.apk"
STALE_IDSIG = ROOT / "public" / "bmw728li-idrive.apk.idsig"
KEYSTORE_DIR = ROOT / ".android-keystore"
BASE_SHELL_ZIP = KEYSTORE_DIR / "base-shell.zip"
KEY_PEM = KEYSTORE_DIR / "bmw728li-release.key.pem"
CERT_PEM = KEYSTORE_DIR / "bmw728li-release.cert.pem"

# Binary / already-compressed assets should be STORED uncompressed & 4-byte aligned
STORED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".woff",
    ".woff2",
    ".mp3",
    ".wav",
    ".ogg",
    ".wasm",
    ".arsc",
}

SKIP_DIST_NAMES = {
    "bmw728li-idrive.apk",
    "bmw728li-idrive.apk.idsig",
    "server.cjs",
    "server.cjs.map",
}

APK_SIG_BLOCK_MAGIC = b"APK Sig Block 42"
APK_V2_BLOCK_ID = 0x7109871A
VERITY_PADDING_BLOCK_ID = 0x42726577
SIG_ALG_RSA_PKCS1_SHA256 = 0x0103
CHUNK_SIZE = 1024 * 1024  # 1 MiB


def ensure_signing_identity() -> tuple[bytes, bytes]:
    KEYSTORE_DIR.mkdir(parents=True, exist_ok=True)
    if not KEY_PEM.exists() or not CERT_PEM.exists():
        subprocess.run(
            [
                "openssl",
                "req",
                "-x509",
                "-newkey",
                "rsa:2048",
                "-keyout",
                str(KEY_PEM),
                "-out",
                str(CERT_PEM),
                "-days",
                "10000",
                "-nodes",
                "-subj",
                "/C=IR/L=Tehran/O=BMW728Li/OU=Cockpit/CN=BMW 728Li iDrive",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        os.chmod(KEY_PEM, 0o600)

    cert_der = subprocess.check_output(
        ["openssl", "x509", "-in", str(CERT_PEM), "-outform", "DER"]
    )
    pub_pem = subprocess.check_output(
        ["openssl", "x509", "-in", str(CERT_PEM), "-pubkey", "-noout"]
    )
    pub_der = subprocess.check_output(
        ["openssl", "pkey", "-pubin", "-outform", "DER"], input=pub_pem
    )
    return cert_der, pub_der


def ensure_base_shell() -> list[tuple[str, bytes, int]]:
    """
    Extracts and caches the native Android shell entries (everything outside assets/www/ and META-INF/)
    from public/bmw728li-idrive.apk so repeated APK rebuilds never lose the shell.
    """
    KEYSTORE_DIR.mkdir(parents=True, exist_ok=True)
    source_zip = BASE_SHELL_ZIP if BASE_SHELL_ZIP.exists() else PUBLIC_APK
    if not source_zip.exists():
        raise FileNotFoundError(f"Base APK shell not found at {source_zip}")

    shell_entries: list[tuple[str, bytes, int]] = []
    with zipfile.ZipFile(source_zip, "r") as zin:
        for info in zin.infolist():
            name = info.filename
            if name.endswith("/"):
                continue
            if name.startswith("assets/www/") or name.startswith("META-INF/"):
                continue
            raw = zin.read(name)
            compress_type = (
                zipfile.ZIP_STORED
                if name == "resources.arsc" or Path(name).suffix.lower() in STORED_EXTENSIONS
                else zipfile.ZIP_DEFLATED
            )
            shell_entries.append((name, raw, compress_type))

    if not BASE_SHELL_ZIP.exists():
        with zipfile.ZipFile(BASE_SHELL_ZIP, "w") as zout:
            for name, raw, ctype in shell_entries:
                zi = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                zi.compress_type = ctype
                zout.writestr(zi, raw)

    return shell_entries


def collect_web_entries() -> list[tuple[str, bytes, int]]:
    if not (DIST_DIR / "index.html").exists():
        raise FileNotFoundError("dist/index.html not found. Run 'npm run build' first.")

    entries: list[tuple[str, bytes, int]] = []
    for path in sorted(DIST_DIR.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(DIST_DIR).as_posix()
        if rel in SKIP_DIST_NAMES or path.name in SKIP_DIST_NAMES:
            continue
        raw = path.read_bytes()
        ctype = (
            zipfile.ZIP_STORED
            if path.suffix.lower() in STORED_EXTENSIONS
            else zipfile.ZIP_DEFLATED
        )
        entries.append((f"assets/www/{rel}", raw, ctype))
    return entries


def wrap_manifest_line(prefix: str, value: str) -> bytes:
    """Wraps a JAR manifest header line to <= 72 UTF-8 bytes per line with CRLF."""
    full = f"{prefix}{value}".encode("utf-8")
    if len(full) <= 72:
        return full + b"\r\n"
    out = bytearray()
    out.extend(full[:72])
    out.extend(b"\r\n")
    idx = 72
    while idx < len(full):
        chunk = full[idx : idx + 71]
        out.extend(b" ")
        out.extend(chunk)
        out.extend(b"\r\n")
        idx += 71
    return bytes(out)


def build_v1_signature(
    entries: list[tuple[str, bytes, int]],
) -> tuple[bytes, bytes, bytes]:
    manifest_buf = bytearray(b"Manifest-Version: 1.0\r\n\r\n")
    sf_sections = bytearray()

    for name, raw, _ in sorted(entries, key=lambda x: x[0]):
        digest_b64 = base64.b64encode(hashlib.sha256(raw).digest()).decode("ascii")
        section = (
            wrap_manifest_line("Name: ", name)
            + f"SHA-256-Digest: {digest_b64}\r\n\r\n".encode("ascii")
        )
        manifest_buf.extend(section)
        sec_digest_b64 = base64.b64encode(hashlib.sha256(section).digest()).decode(
            "ascii"
        )
        sf_sections.extend(
            wrap_manifest_line("Name: ", name)
            + f"SHA-256-Digest: {sec_digest_b64}\r\n\r\n".encode("ascii")
        )

    manifest_bytes = bytes(manifest_buf)
    manifest_digest_b64 = base64.b64encode(
        hashlib.sha256(manifest_bytes).digest()
    ).decode("ascii")

    sf_header = (
        f"Signature-Version: 1.0\r\n"
        f"Created-By: 1.0 (Android)\r\n"
        f"SHA-256-Digest-Manifest: {manifest_digest_b64}\r\n"
        f"X-Android-APK-Signed: 2\r\n\r\n"
    ).encode("ascii")
    sf_bytes = sf_header + bytes(sf_sections)

    with tempfile.NamedTemporaryFile(delete=False) as tmp_sf:
        tmp_sf.write(sf_bytes)
        tmp_sf_path = tmp_sf.name
    try:
        rsa_bytes = subprocess.check_output(
            [
                "openssl",
                "cms",
                "-sign",
                "-binary",
                "-noattr",
                "-md",
                "sha256",
                "-outform",
                "DER",
                "-signer",
                str(CERT_PEM),
                "-inkey",
                str(KEY_PEM),
                "-in",
                tmp_sf_path,
            ]
        )
    finally:
        os.unlink(tmp_sf_path)

    return manifest_bytes, sf_bytes, rsa_bytes


def deflate_raw(data: bytes) -> bytes:
    comp = zlib.compressobj(level=zlib.Z_BEST_COMPRESSION, method=zlib.DEFLATED, wbits=-15)
    return comp.compress(data) + comp.flush()


def build_zipaligned_archive(
    entries: list[tuple[str, bytes, int]],
) -> tuple[bytes, bytes, bytes]:
    """
    Builds ZIP entries (zipaligned to 4 bytes for STORED entries), Central Directory, and EOCD.
    Returns (entries_bytes, cd_bytes, eocd_bytes).
    """
    entries_buf = bytearray()
    cd_buf = bytearray()

    # Fixed DOS timestamp: 1980-01-01 00:00:00
    dos_time = 0
    dos_date = 0x0021

    for name, raw, ctype in entries:
        name_bytes = name.encode("utf-8")
        crc = zlib.crc32(raw) & 0xFFFFFFFF
        uncomp_size = len(raw)

        if ctype == zipfile.ZIP_DEFLATED:
            payload = deflate_raw(raw)
            method = 8
        else:
            payload = raw
            method = 0
        comp_size = len(payload)

        lfh_offset = len(entries_buf)
        extra_lfh = b""
        if method == 0:
            # 4-byte align uncompressed data payload offset
            data_pos = lfh_offset + 30 + len(name_bytes)
            pad = (4 - (data_pos % 4)) % 4
            if pad:
                extra_lfh = b"\x00" * pad

        lfh = struct.pack(
            "<IHHHHHIIIHH",
            0x04034B50,
            20,  # version needed
            0x0800,  # UTF-8 flag
            method,
            dos_time,
            dos_date,
            crc,
            comp_size,
            uncomp_size,
            len(name_bytes),
            len(extra_lfh),
        )
        entries_buf.extend(lfh)
        entries_buf.extend(name_bytes)
        entries_buf.extend(extra_lfh)
        entries_buf.extend(payload)

        cdh = struct.pack(
            "<IHHHHHHIIIHHHHHII",
            0x02014B50,
            20,  # version made by
            20,  # version needed
            0x0800,  # UTF-8 flag
            method,
            dos_time,
            dos_date,
            crc,
            comp_size,
            uncomp_size,
            len(name_bytes),
            0,  # extra len in CD
            0,  # comment len
            0,  # disk start
            0,  # internal attrs
            0,  # external attrs
            lfh_offset,
        )
        cd_buf.extend(cdh)
        cd_buf.extend(name_bytes)

    cd_offset = len(entries_buf)
    cd_size = len(cd_buf)
    count = len(entries)
    eocd = struct.pack(
        "<IHHHHIIH",
        0x06054B50,
        0,
        0,
        count,
        count,
        cd_size,
        cd_offset,
        0,
    )
    return bytes(entries_buf), bytes(cd_buf), eocd


def lp(blob: bytes) -> bytes:
    return struct.pack("<I", len(blob)) + blob


def sign_v2_and_assemble(
    entries_bytes: bytes,
    cd_bytes: bytes,
    eocd_bytes: bytes,
    cert_der: bytes,
    pub_der: bytes,
) -> bytes:
    # For v2 digest calculation, EOCD cd_offset points to end of entries_bytes (start of Sig Block)
    patched_eocd_for_digest = bytearray(eocd_bytes)
    struct.pack_into("<I", patched_eocd_for_digest, 16, len(entries_bytes))

    chunk_digests = []
    for section in (entries_bytes, cd_bytes, bytes(patched_eocd_for_digest)):
        if len(section) == 0:
            chunk_digests.append(
                hashlib.sha256(b"\xa5" + struct.pack("<I", 0)).digest()
            )
            continue
        for i in range(0, len(section), CHUNK_SIZE):
            chunk = section[i : i + CHUNK_SIZE]
            chunk_digests.append(
                hashlib.sha256(b"\xa5" + struct.pack("<I", len(chunk)) + chunk).digest()
            )

    content_digest = hashlib.sha256(
        b"\x5a" + struct.pack("<I", len(chunk_digests)) + b"".join(chunk_digests)
    ).digest()

    digests_seq = lp(lp(struct.pack("<I", SIG_ALG_RSA_PKCS1_SHA256) + lp(content_digest)))
    certs_seq = lp(lp(cert_der))
    attrs_seq = lp(b"")
    signed_data = digests_seq + certs_seq + attrs_seq

    with tempfile.NamedTemporaryFile(delete=False) as tmp_sd:
        tmp_sd.write(signed_data)
        tmp_sd_path = tmp_sd.name
    try:
        sig_bytes = subprocess.check_output(
            ["openssl", "dgst", "-sha256", "-sign", str(KEY_PEM), tmp_sd_path]
        )
    finally:
        os.unlink(tmp_sd_path)

    sigs_seq = lp(lp(struct.pack("<I", SIG_ALG_RSA_PKCS1_SHA256) + lp(sig_bytes)))
    signer_blob = lp(signed_data) + sigs_seq + lp(pub_der)
    v2_value = lp(lp(signer_blob))
    v2_pair = struct.pack("<QI", 4 + len(v2_value), APK_V2_BLOCK_ID) + v2_value

    # Align total APK Sig Block + entries_bytes to 4096-byte page boundary via Verity padding block
    base_len = len(entries_bytes) + 8 + len(v2_pair) + 24
    rem = base_len % 4096
    pad_pair = b""
    if rem != 0:
        needed_total = 4096 - rem
        if needed_total < 12:
            needed_total += 4096
        zero_len = needed_total - 12
        pad_pair = struct.pack("<QI", 4 + zero_len, VERITY_PADDING_BLOCK_ID) + (
            b"\x00" * zero_len
        )

    pairs = v2_pair + pad_pair
    blk_size = len(pairs) + 24
    apk_sig_block = (
        struct.pack("<Q", blk_size)
        + pairs
        + struct.pack("<Q", blk_size)
        + APK_SIG_BLOCK_MAGIC
    )

    final_cd_offset = len(entries_bytes) + len(apk_sig_block)
    final_eocd = bytearray(eocd_bytes)
    struct.pack_into("<I", final_eocd, 16, final_cd_offset)

    return entries_bytes + apk_sig_block + cd_bytes + bytes(final_eocd)


def verify_output_apk(apk_path: Path) -> None:
    data = apk_path.read_bytes()
    with zipfile.ZipFile(apk_path, "r") as z:
        bad = z.testzip()
        if bad is not None:
            raise RuntimeError(f"ZIP integrity failure on entry: {bad}")
        for info in z.infolist():
            if info.compress_type == zipfile.ZIP_STORED:
                off = info.header_offset
                fname_len, extra_len = struct.unpack_from("<HH", data, off + 26)
                data_off = off + 30 + fname_len + extra_len
                if data_off % 4 != 0:
                    raise RuntimeError(
                        f"Unaligned STORED entry {info.filename} at {data_off}"
                    )

        sf = z.read("META-INF/BMW728LI.SF")
        rsa = z.read("META-INF/BMW728LI.RSA")

    with tempfile.NamedTemporaryFile() as fsf, tempfile.NamedTemporaryFile() as frsa:
        fsf.write(sf)
        fsf.flush()
        frsa.write(rsa)
        frsa.flush()
        subprocess.run(
            [
                "openssl",
                "cms",
                "-verify",
                "-inform",
                "DER",
                "-in",
                frsa.name,
                "-content",
                fsf.name,
                "-noverify",
                "-out",
                "/dev/null",
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    # Verify v2 APK Signing Block digest & signature
    eocd = data.rfind(b"PK\x05\x06")
    _, cd_offset = struct.unpack_from("<II", data, eocd + 12)
    blk_size2, magic = struct.unpack_from("<Q16s", data, cd_offset - 24)
    assert magic == APK_SIG_BLOCK_MAGIC
    blk_start = cd_offset - blk_size2 - 8
    pos = blk_start + 8
    verified_v2 = False
    while pos < cd_offset - 24:
        pair_len = struct.unpack_from("<Q", data, pos)[0]
        pair_id = struct.unpack_from("<I", data, pos + 8)[0]
        if pair_id == APK_V2_BLOCK_ID:
            val = data[pos + 12 : pos + 8 + pair_len]
            signer_len = struct.unpack_from("<I", val, 4)[0]
            signer = val[8 : 8 + signer_len]
            sd_len = struct.unpack_from("<I", signer, 0)[0]
            signed_data = signer[4 : 4 + sd_len]
            sigs_off = 4 + sd_len
            sigs_len = struct.unpack_from("<I", signer, sigs_off)[0]
            sig1_len = struct.unpack_from("<I", signer, sigs_off + 12)[0]
            sig_bytes = signer[sigs_off + 16 : sigs_off + 16 + sig1_len]
            with tempfile.NamedTemporaryFile() as fs, tempfile.NamedTemporaryFile() as fd:
                fs.write(sig_bytes)
                fs.flush()
                fd.write(signed_data)
                fd.flush()
                pub_pem = subprocess.check_output(
                    ["openssl", "x509", "-in", str(CERT_PEM), "-pubkey", "-noout"]
                )
                with tempfile.NamedTemporaryFile() as fp:
                    fp.write(pub_pem)
                    fp.flush()
                    subprocess.run(
                        [
                            "openssl",
                            "dgst",
                            "-sha256",
                            "-verify",
                            fp.name,
                            "-signature",
                            fs.name,
                            fd.name,
                        ],
                        check=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
            verified_v2 = True
        pos += 8 + pair_len
    if not verified_v2:
        raise RuntimeError("Missing v2 APK signature block")


def main() -> None:
    cert_der, pub_der = ensure_signing_identity()
    shell_entries = ensure_base_shell()
    web_entries = collect_web_entries()
    app_entries = sorted(shell_entries + web_entries, key=lambda x: x[0])

    manifest_bytes, sf_bytes, rsa_bytes = build_v1_signature(app_entries)
    all_entries = app_entries + [
        ("META-INF/MANIFEST.MF", manifest_bytes, zipfile.ZIP_DEFLATED),
        ("META-INF/BMW728LI.SF", sf_bytes, zipfile.ZIP_DEFLATED),
        ("META-INF/BMW728LI.RSA", rsa_bytes, zipfile.ZIP_DEFLATED),
    ]

    entries_bytes, cd_bytes, eocd_bytes = build_zipaligned_archive(all_entries)
    signed_apk = sign_v2_and_assemble(
        entries_bytes, cd_bytes, eocd_bytes, cert_der, pub_der
    )

    tmp_out = PUBLIC_APK.with_suffix(".apk.tmp")
    tmp_out.write_bytes(signed_apk)
    verify_output_apk(tmp_out)
    shutil.move(tmp_out, PUBLIC_APK)

    if STALE_IDSIG.exists():
        STALE_IDSIG.unlink()

    print(
        f"Built & verified {PUBLIC_APK.name}: {PUBLIC_APK.stat().st_size} bytes, "
        f"{len(web_entries)} web assets bundled."
    )


if __name__ == "__main__":
    main()
