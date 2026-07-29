export type ConfirmationSemantics = {
  verificationMethod?: "bitcoin-core" | "embedded-attestation";
  confirmedAt?: string | null;
};

export function confirmationLabel(result: ConfirmationSemantics) {
  return result.verificationMethod === "bitcoin-core" || result.confirmedAt
    ? "Independently verified"
    : "Bitcoin attestation found";
}
