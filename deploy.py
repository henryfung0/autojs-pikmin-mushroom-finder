#!/usr/bin/env python3
"""Deploy pikmin scripts to phone via FTP."""
import ftplib
import os
import sys
import tempfile
import subprocess

FTP_HOST = "192.168.0.122"
FTP_PORT = 2121
FTP_USER = "admin"
FTP_PASS = "password"
REMOTE_BASE = "/Scripts/pikmin"
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

EXCLUDES = {
    ".git", ".claude", ".gitnexus", ".omo", ".sisyphus",
    "node_modules", "AGENTS.md", "CLAUDE.md", "README.md",
    "deploy.sh", "deploy.py", ".DS_Store", ".gitignore",
}

def should_exclude(path):
    parts = path.split(os.sep)
    for part in parts:
        if part in EXCLUDES or part.startswith(".") and part != ".":
            return True
    return False

def mkdir_p(ftp, remote_dir):
    """Recursively create remote directory."""
    parts = remote_dir.strip("/").split("/")
    current = ""
    for part in parts:
        current += "/" + part
        try:
            ftp.mkd(current)
        except ftplib.error_perm:
            pass

def deploy():
    print(f"Connecting to {FTP_HOST}:{FTP_PORT}...")
    ftp = ftplib.FTP()
    ftp.connect(FTP_HOST, FTP_PORT)
    ftp.login(FTP_USER, FTP_PASS)
    print(f"Connected. Creating {REMOTE_BASE}...")

    try:
        ftp.mkd(REMOTE_BASE)
    except ftplib.error_perm:
        pass

    uploaded = 0
    skipped = 0

    for root, dirs, files in os.walk(LOCAL_DIR):
        rel_root = os.path.relpath(root, LOCAL_DIR)
        if rel_root == ".":
            rel_root = ""

        # Filter out excluded dirs
        dirs[:] = [d for d in dirs if not should_exclude(os.path.join(rel_root, d))]

        # Create remote directory
        if rel_root:
            remote_dir = f"{REMOTE_BASE}/{rel_root}"
            try:
                ftp.mkd(remote_dir)
            except ftplib.error_perm:
                pass

        for fname in files:
            local_path = os.path.join(root, fname)
            rel_path = os.path.join(rel_root, fname) if rel_root else fname

            if should_exclude(rel_path):
                skipped += 1
                continue

            remote_path = f"{REMOTE_BASE}/{rel_path}".replace(os.sep, "/")

            try:
                with open(local_path, "rb") as f:
                    ftp.storbinary(f"STOR {remote_path}", f)
                print(f"  {rel_path}")
                uploaded += 1
            except Exception as e:
                print(f"  FAIL: {rel_path} - {e}")

    ftp.quit()
    print(f"\nDone. Uploaded {uploaded} files, skipped {skipped}.")

if __name__ == "__main__":
    deploy()
