import os
import re

# DEMO_MODE: when True, worksheet export blocked unless suspects match SUBJECT-NNN
DEMO_MODE = os.environ.get("TRACE_DEMO_MODE", "false").lower() == "true"
DEMO_SUBJECT_PATTERN = re.compile(r"^SUBJECT-\d{3}$")
