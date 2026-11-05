/** The monitor owns global health. Completed task jobs must not become failed backups/analyses because another source is unhealthy. */
export function monitorScope(jobId) {
  return ["backup", "finance"].includes(jobId) ? "task" : "monitor";
}
export function monitorFailed(
  findings,
  {
    transportFailed = false,
    backupFailed = false,
    testAlert = false,
    scope = "monitor",
  } = {},
) {
  return (
    transportFailed ||
    backupFailed ||
    testAlert ||
    (scope !== "task" && findings.some((item) => item.severity !== "warning"))
  );
}
