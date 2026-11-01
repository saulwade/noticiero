export async function updateEdition(id: string) {
  "use workflow";
  try {
    await collectStep(id);
    const stories = await storyIdsStep(id);
    for (let index = 0; index < stories.length; index += 2) {
      await analysisStep(id, stories.slice(index, index + 2));
    }
    await ideasStep(id);
    await financeStep();
    await marketStep(id);
    await financeNewsStep();
    await finishStep(id);
  } catch {
    await failStep(id);
  }
}
async function collectStep(id: string) {
  "use step";
  const { collectNews } = await import("@/features/jobs/update");
  await collectNews(id);
}
async function storyIdsStep(id: string) {
  "use step";
  const { getJob } = await import("@/db/repository");
  return (await getJob(id))?.storyIds ?? [];
}
async function analysisStep(id: string, ids: string[]) {
  "use step";
  const { analyzeNews } = await import("@/features/jobs/update");
  await analyzeNews(id, ids);
}
async function ideasStep(id: string) {
  "use step";
  const { analyzeIdeas } = await import("@/features/jobs/update");
  await analyzeIdeas(id);
}
async function marketStep(id: string) {
  "use step";
  const { collectMarket } = await import("@/features/jobs/update");
  await collectMarket(id);
}
async function finishStep(id: string) {
  "use step";
  const { finishUpdate } = await import("@/features/jobs/update");
  await finishUpdate(id);
}
async function failStep(id: string) {
  "use step";
  const { failUpdate } = await import("@/features/jobs/update");
  await failUpdate(id);
}

async function financeStep() {
  "use step";
  const { syncDailyFinance } = await import("@/features/finance/daily-sync");
  try {
    await syncDailyFinance();
  } catch {
    // Finance status is checked independently; preserve news publication on failure.
  }
}

async function financeNewsStep() {
  "use step";
  const { collectFinanceNews } =
    await import("@/features/finance/research-service");
  try {
    await collectFinanceNews();
  } catch {
    /* Status and previous archive are retained for operations. */
  }
}
