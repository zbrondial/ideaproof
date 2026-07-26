export function e2eFixturesEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.IDEAPROOF_E2E_FIXTURES === "1"
  );
}
