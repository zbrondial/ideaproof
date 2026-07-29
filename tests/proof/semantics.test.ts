import { expect, it } from "vitest";

import { confirmationLabel } from "@/server/proof/semantics";

it("distinguishes independent verification from an embedded attestation", () => {
  expect(
    confirmationLabel({
      verificationMethod: "bitcoin-core",
      confirmedAt: "2026-07-25",
    }),
  ).toBe("Independently verified");
  expect(
    confirmationLabel({
      verificationMethod: "embedded-attestation",
    }),
  ).toBe("Bitcoin attestation found");
});
