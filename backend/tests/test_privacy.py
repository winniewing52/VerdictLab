import unittest

from app.services.privacy import apply_privacy, scoring_text

SAMPLE = "Ask u/jane_doe or @bob at bob@mail.com, call +44 20 7946 0958, see https://example.com/x?id=1 on 2026-03-04."

class PrivacyTest(unittest.TestCase):
    def test_redacted_removes_identifiers_and_counts_them(self):
        text, counts = apply_privacy(SAMPLE, "redacted")
        for secret in ("jane_doe", "bob@mail.com", "7946", "example.com"):
            self.assertNotIn(secret, text)
        self.assertEqual(counts, {"emails": 1, "phones": 1, "handles": 2, "urls": 1})
        self.assertIn("2026-03-04", text)  # a date is not a phone number

    def test_raw_keeps_text_as_written(self):
        text, counts = apply_privacy(SAMPLE, "raw")
        self.assertIn("u/jane_doe", text)
        self.assertIn("https://example.com/x?id=1", text)
        self.assertEqual(sum(counts.values()), 0)

    def test_unknown_mode_falls_back_to_redacted(self):
        text, _ = apply_privacy(SAMPLE, "anything-else")
        self.assertNotIn("jane_doe", text)

    def test_scoring_text_is_the_same_whatever_the_mode(self):
        cleaned = scoring_text(SAMPLE)
        self.assertNotIn("example.com", cleaned)
        self.assertNotIn("bob@mail.com", cleaned)
        self.assertIn("[user]", cleaned)

if __name__ == "__main__":
    unittest.main()