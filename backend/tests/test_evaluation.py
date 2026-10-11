import unittest

from app.services.evaluation import _label, _metrics


class EvaluationHelpersTest(unittest.TestCase):
    def test_label_accepts_documented_aliases_only(self):
        self.assertEqual(_label("POS"), "positive")
        self.assertEqual(_label("neutral"), "neutral")
        self.assertIsNone(_label("mixed"))

    def test_metrics_reports_accuracy_and_macro_f1(self):
        actual = ["positive", "neutral", "negative"]
        predicted = ["positive", "negative", "negative"]

        result = _metrics(actual, predicted)

        self.assertAlmostEqual(result["accuracy"], 2 / 3, places=4)
        self.assertEqual(result["confusion_matrix"]["neutral"]["negative"], 1)
        self.assertEqual(set(result["per_class"]), {"positive", "neutral", "negative"})


if __name__ == "__main__":
    unittest.main()
