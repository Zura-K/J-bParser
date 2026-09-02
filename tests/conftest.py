import os
import shutil
import subprocess
import time

import pytest
import valkey

test_port = "6391"
os.environ["VALKEY_URL"] = f"valkey://localhost:{test_port}/0"

from library import store


@pytest.fixture(scope="session", autouse=True)
def valkey_server():
    binary = shutil.which("valkey-server") or shutil.which("redis-server")
    if binary is None:
        pytest.skip("no valkey-server or redis-server on PATH")
    process = subprocess.Popen(
        [binary, "--port", test_port, "--save", "", "--appendonly", "no"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(50):
        try:
            store.client.ping()
            break
        except valkey.exceptions.ConnectionError:
            time.sleep(0.1)
    yield
    process.terminate()
    process.wait()


@pytest.fixture(autouse=True)
def flush_valkey(valkey_server):
    store.client.flushall()
