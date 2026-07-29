import { describe, expect, it } from "vitest";

import { parseOtsInfo, parseOtsOutput } from "@/server/proof/parse";

describe("parseOtsOutput", () => {
  it.each([
    [
      "Success! Bitcoin block 900000 attests existence as of 2026-07-25 UTC",
      "confirmed",
    ],
    ["Pending confirmation in Bitcoin blockchain", "pending"],
    ["Digest mismatch", "mismatch"],
    ["Invalid timestamp proof", "invalid"],
  ] as const)("maps %s to %s", (output, status) => {
    expect(parseOtsOutput(output)).toMatchObject({ status });
  });

  it("extracts confirmation details", () => {
    expect(
      parseOtsOutput(
        "Success! Bitcoin block 900000 attests existence as of 2026-07-25 UTC",
      ),
    ).toEqual({
      status: "confirmed",
      verificationMethod: "bitcoin-core",
      bitcoinBlockHeight: 900000,
      confirmedAt: "2026-07-25",
    });
  });
});

describe("parseOtsInfo", () => {
  it("identifies an embedded attestation without claiming Bitcoin Core verification", () => {
    expect(
      parseOtsInfo(
        "File sha256 hash: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\nTimestamp:\nverify BitcoinBlockHeaderAttestation(959810)",
        "a".repeat(64),
      ),
    ).toEqual({
      status: "confirmed",
      verificationMethod: "embedded-attestation",
      bitcoinBlockHeight: 959810,
    });
  });
});
