# Independent evaluation

VerdictLab does not treat production records or a hand-written sanity check as
labelled evidence. The `POST /evaluations/sentiment` endpoint accepts a CSV,
XLS, or XLSX file with a text column and a human label column. It requires at
least 100 valid rows and returns:

- accuracy and macro-F1;
- precision, recall, and F1 for positive, neutral, and negative;
- a row-normalised-by-label-count-independent confusion matrix (raw counts);
- the number of skipped rows and the exact columns evaluated.

Use a held-out test split and report the dataset version, sampling procedure,
annotator agreement, and confidence intervals in the paper. For a published
comparison, use the same label mapping and split as the **TweetEval sentiment
task** (Barbieri et al., 2020, *TweetEval: Unified Benchmark and Comparative
Evaluation for Tweet Classification*). The API returns this citation as a
reference, but intentionally does not invent a benchmark score: the matching
TweetEval test split must be supplied and evaluated before a numerical
comparison is claimed.

The evaluator also returns deterministic percentile-bootstrap 95% confidence
intervals (2,000 resamples, seed 17) for accuracy, macro-F1, and every
per-class precision/recall/F1 value. It reports a pre-declared text-length
slice (0–80 vs 81+ characters) so the result can say where a model wins or
loses instead of hiding behind one aggregate number. No threshold tuning is
performed on the uploaded test set.

The research question for this comparison is:

> Does explainable concept-level analysis reach the same conclusions as
> standard sentiment tools on real public debate, and when does it disagree?

Do not fill the result with production labels, SenticNet-derived labels, or
hand-written sanity examples. Those are useful for exploration, not human
ground truth. The repository currently contains no human-labelled held-out
set, so it intentionally does not publish a benchmark finding yet. The next
reproducible step is to add a versioned CSV with at least 100 independently
labelled rows, freeze the split, record annotator agreement, upload it to the
endpoint, and preserve the JSON response as the evaluation artifact.

The four Hourglass dimensions are currently SenticNet-derived exploratory
indicators. They are not validated emotion labels. A separate human-labelled
emotion dataset and the same per-class evaluation protocol are required before
they are presented as validated measurements.

## What the current endpoint does not prove

The evaluator compares the raw SenticNet polarity label with VADER and
TextBlob on the uploaded human-labelled rows. It does not turn a production
analysis into ground truth, and it does not include a modern neural model yet.
Before adding one, freeze the model version, tokenizer/preprocessing,
hardware/runtime constraints, and any prompt or label mapping in the dataset
protocol. Report it as a fourth comparison rather than silently replacing the
three reproducible baselines.

The production pipeline separately reports how many rows used SenticNet and how
many used the declared VADER fallback. Therefore a production average should
always be described as a hybrid `SenticNet-or-VADER` signal, never as a pure
SenticNet score.
