#!/usr/bin/env python3
"""Save Mozilla publishing credentials without displaying them."""

import getpass
import json
import os
import tempfile
from pathlib import Path


def ask(label):
    while True:
        value = getpass.getpass(label).strip()
        if value:
            return value
        print("Please enter a nonempty value.")


def main():
    destination = Path(__file__).resolve().parent / ".amo-credentials.json"
    print("Enter your Mozilla API credentials. Your input will be hidden.")
    credentials = {
        "apiKey": ask("JWT issuer (API key): "),
        "apiSecret": ask("JWT secret: "),
    }
    temporary = None
    try:
        fd, temporary = tempfile.mkstemp(prefix=".amo-credentials-", dir=destination.parent)
        with os.fdopen(fd, "w") as file:
            json.dump(credentials, file)
            file.write("\n")
        os.replace(temporary, destination)
    finally:
        if temporary is not None and os.path.exists(temporary):
            os.unlink(temporary)
    print(f"Credentials saved to {destination} (owner access only).")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled. Existing credentials were not changed.")
        raise SystemExit(1)
