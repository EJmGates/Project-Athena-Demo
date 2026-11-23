
"""Adapt the existing Athena request handler to a browser-local request."""
from email.message import Message
from io import BytesIO

from athena.server import H

def dispatch(method, path, headers, data):
    body = bytes(data)
    handler = H.__new__(H)
    handler.path = path
    handler.headers = Message()
    for name, value in headers:
        if name.lower() != "content-length":
            handler.headers[name] = value
    handler.headers["Content-Length"] = str(len(body))
    handler.rfile = BytesIO(body)
    result = None

    def respond(status, contents, content_type, extra=None):
        nonlocal result
        result = (status, contents, {"Content-Type": content_type, **(extra or {})})

    handler.bytes = respond
    if method == "GET":
        handler.do_GET()
    elif method == "POST":
        handler.do_POST()
    else:
        handler.err(405, "METHOD-NOT-ALLOWED", "This request method is unavailable.")
    return result

