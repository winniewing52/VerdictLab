import os
import unittest
from unittest import mock

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import LoginChallenge, User
from app.security import hash_password

client = TestClient(app)
EMAIL, PASSWORD = "judge@example.org", "correct horse battery"

def _reset(two_factor: bool):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    db.query(LoginChallenge).delete()
    db.query(User).delete()
    db.add(User(email=EMAIL, password_hash=hash_password(PASSWORD), two_factor_enabled=1 if two_factor else 0))
    db.commit()
    db.close()

class TwoFactorTest(unittest.TestCase):
    def test_without_two_factor_login_returns_a_token(self):
        _reset(False)
        body = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()
        self.assertTrue(body["token"])
        self.assertFalse(body["two_factor_required"])

    def test_with_two_factor_password_alone_gives_no_session(self):
        _reset(True)
        body = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()
        self.assertTrue(body["two_factor_required"])
        self.assertIsNone(body["token"])
        self.assertTrue(body["challenge_id"])

    def test_wrong_code_is_rejected_and_right_code_signs_in(self):
        _reset(True)
        first = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()
        bad = client.post("/auth/login/verify-2fa", json={"challenge_id": first["challenge_id"], "code": "000000" if first["dev_code"] != "000000" else "111111"})
        self.assertEqual(bad.status_code, 400)
        good = client.post("/auth/login/verify-2fa", json={"challenge_id": first["challenge_id"], "code": first["dev_code"]})
        self.assertEqual(good.status_code, 200)
        token = good.json()["token"]
        self.assertEqual(client.get("/auth/profile", headers={"Authorization": f"Bearer {token}"}).status_code, 200)
        reuse = client.post("/auth/login/verify-2fa", json={"challenge_id": first["challenge_id"], "code": first["dev_code"]})
        self.assertEqual(reuse.status_code, 400)  # a code works once

    def test_five_wrong_codes_burn_the_challenge(self):
        _reset(True)
        first = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()
        wrong = "000000" if first["dev_code"] != "000000" else "111111"
        statuses = [client.post("/auth/login/verify-2fa", json={"challenge_id": first["challenge_id"], "code": wrong}).status_code for _ in range(5)]
        self.assertEqual(statuses[-1], 429)
        after = client.post("/auth/login/verify-2fa", json={"challenge_id": first["challenge_id"], "code": first["dev_code"]})
        self.assertEqual(after.status_code, 400)

    def test_cannot_enable_two_factor_when_no_code_can_be_delivered(self):
        _reset(False)
        token = client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD}).json()["token"]
        with mock.patch.dict(os.environ, {"VERDICTLAB_DEV_CODES": "false"}):
            response = client.post("/auth/two-factor", json={"password": PASSWORD, "enabled": True},
                                   headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(response.status_code, 400)

if __name__ == "__main__":
    unittest.main()
