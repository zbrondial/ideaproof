export type VerificationResult =
  | {
      status: "confirmed";
      bitcoinBlockHeight: number;
      confirmedAt: string;
    }
  | { status: "pending" | "mismatch" | "invalid" };

export function parseOtsOutput(output: string): VerificationResult {
  if (/digest mismatch|does not match/i.test(output)) {
    return { status: "mismatch" };
  }
  if (/invalid|malformed|cannot be parsed/i.test(output)) {
    return { status: "invalid" };
  }

  const block = output.match(/bitcoin block\s+(\d+)/i);
  const date = output.match(
    /attests existence as of\s+(\d{4}-\d{2}-\d{2})/i,
  );
  if (/success|attests existence/i.test(output) && block && date) {
    return {
      status: "confirmed",
      bitcoinBlockHeight: Number(block[1]),
      confirmedAt: date[1],
    };
  }
  return { status: "pending" };
}
