import unittest
from unittest.mock import Mock, patch

from app.services.ingest import ingest_reddit


class RedditIngestTest(unittest.TestCase):
    @patch("app.services.ingest._ingest_reddit_rss", return_value=[{"text": "RSS post", "kind": "post"}])
    @patch("app.services.ingest.httpx.Client")
    def test_post_url_uses_rss_when_json_is_blocked(self, client_cls, rss_ingest):
        client = client_cls.return_value.__enter__.return_value
        response = Mock(status_code=403)
        client.get.return_value = response

        records = ingest_reddit(
            "https://www.reddit.com/r/malaysia/comments/1x1fjsd/discussion_of_budget_2027"
        )

        self.assertEqual(records, [{"text": "RSS post", "kind": "post"}])
        rss_ingest.assert_called_once_with(
            client,
            "https://www.reddit.com/r/malaysia/comments/1x1fjsd/discussion_of_budget_2027",
        )

    @patch("app.services.ingest._ingest_reddit_rss", return_value=[])
    @patch("app.services.ingest.httpx.Client")
    def test_non_reddit_403_is_not_treated_as_rss(self, client_cls, _rss_ingest):
        client = client_cls.return_value.__enter__.return_value
        response = Mock(status_code=403)
        response.raise_for_status.side_effect = RuntimeError("blocked")
        client.get.return_value = response

        with self.assertRaises(RuntimeError):
            ingest_reddit("https://example.com/r/malaysia")


if __name__ == "__main__":
    unittest.main()
