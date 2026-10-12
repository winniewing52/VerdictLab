import unittest

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Analysis, Session as SessionModel, User
from app.security import hash_password


client = TestClient(app)
EMAIL = "analysis-auth@example.org"
PASSWORD = "correct horse battery"


def _reset():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    db.query(Analysis).delete()
    db.query(SessionModel).delete()
    db.query(User).delete()
    db.add(User(email=EMAIL, password_hash=hash_password(PASSWORD)))
    db.commit()
    db.close()


class AnalysisAuthTest(unittest.TestCase):
    def test_workspace_list_rejects_unknown_session_instead_of_returning_empty(self):
        _reset()

        response = client.get(
            "/analyses",
            headers={"Authorization": "Bearer stale-session-token"},
        )

        self.assertEqual(response.status_code, 401)

    def test_workspace_list_returns_rows_for_authenticated_user(self):
        _reset()
        login = client.post(
            "/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
        )
        self.assertEqual(login.status_code, 200)

        response = client.get(
            "/analyses",
            headers={"Authorization": f"Bearer {login.json()['token']}"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])


if __name__ == "__main__":
    unittest.main()
