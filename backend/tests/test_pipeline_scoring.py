from app.services.pipeline import _scoring_audit


def test_precomputed_rows_are_not_counted_as_senticnet():
    scored = [{
        "engine": "precomputed",
        "sentic_coverage": None,
        "emotion_source": "not_available",
        "textblob_score": None,
    }]

    audit = _scoring_audit(scored)

    assert audit["records_scored_by_senticnet"] == 0
    assert audit["records_precomputed"] == 1
    assert audit["records_vader_fallback"] == 0
    assert audit["senticnet_usable_pct"] == 0.0
    assert audit["mean_concept_coverage_pct"] is None
