export type VerificationResult =
  | {
      status: "confirmed";
      bitcoinBlockHeight: number;
      confirmedAt?: string;
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

export function parseOtsInfo(
  output: string,
  expectedSha256: string,
): VerificationResult {
  const proofSha256 = output.match(/file sha256 hash:\s*([a-f0-9]{64})/i)?.[1];
  if (!proofSha256 || proofSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    return { status: "mismatch" };
  }

  const blockHeights = [
    ...output.matchAll(/BitcoinBlockHeaderAttestation\((\d+)\)/g),
  ].map((match) => Number(match[1]));
  if (blockHeights.length === 0) return { status: "pending" };

  return {
    status: "confirmed",
    bitcoinBlockHeight: Math.min(...blockHeights),
  };
}
