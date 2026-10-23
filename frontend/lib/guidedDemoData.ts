export const GUIDED_DEMO_CONFLICTS = [
  {
    id: "israel-gaza",
    label: "Israel-Gaza",
    description: "Choose this conversation to explore its public language.",
  },
  {
    id: "us-iran",
    label: "US-Iran",
    description: "Choose this conversation to explore its public language.",
  },
] as const;

export const GUIDED_DEMO_EVIDENCE = {
  text: "Stop the war, too many innocent people are dying.",
  senticNet: 0.541,
  vader: -0.57,
  textBlob: null,
} as const;
