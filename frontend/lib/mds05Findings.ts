export const MDS05_FINDINGS = {
  datasetRecords: 6496344,
  labelledRecords: 1000,
  modelAgreementPct: 49.4,
  vaderHumanMatchPct: 51.1,
  senticNetHumanMatchPct: 36.8,
  tweetEvalRecords: 12284,
  tweetEvalSenticNetAccuracyPct: 36.9,
  tweetEvalSenticNetAccuracyCi: "36.1–37.8%",
  tweetEvalVaderAccuracyPct: 54.5,
  tweetEvalVaderAccuracyCi: "53.6–55.4%",
} as const;

export const formatMds05Records = (value: number) => value.toLocaleString("en-US");
