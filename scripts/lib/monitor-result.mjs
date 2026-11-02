/** Only explicitly classified warnings can avoid a failed Actions run. */
export function monitorFailed(
  findings,
  { transportFailed = false, backupFailed = false, testAlert = false } = {},
) {
  return (
    transportFailed ||
    backupFailed ||
    testAlert ||
    findings.some((item) => item.severity !== "warning")
  );
}
