import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="verdictlab-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["VERDICTLAB_DEV_CODES"] = "true"
os.environ["VERDICTLAB_SKIP_DEMO_SEED"] = "true"
os.environ.pop("SMTP_HOST", None)
