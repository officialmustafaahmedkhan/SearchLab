"""
Vercel serverless entrypoint for the SearchLab execution engine.

Vercel's Python runtime serves any ASGI/WSGI application exported as ``app``
from a file under ``api/``. The full engine lives in ``python_engine.py`` at the
repository root; this module simply re-exports it so Vercel can find it without
duplicating any logic.

What runs here
--------------
* ``POST /extract-graph``  - pure ``ast`` parsing, no execution. Always works.
* ``POST /execute``        - Python execution (Learning and Trace modes).

What does NOT run here
----------------------
* ``POST /execute-java``   - Vercel ships no JDK and forbids the subprocess work
  the Java path needs. ``GET /health`` reports ``java: "unavailable"`` so the
  frontend hides the Java option when hosted.

Locally nothing changes: run ``npm run engine`` and both languages work.
"""

import os
import sys

# Make the repository root importable when Vercel runs this file from api/.
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from python_engine import app  # noqa: E402  (import must follow sys.path setup)

__all__ = ["app"]
