import { after } from "next/server";
import { beginUpdate, failUpdate, runLocalUpdate } from "./update";
export async function dispatchUpdate() {
  const result = await beginUpdate();
  if (!result.reused) {
    try {
      if (process.env.VERCEL) {
        const [{ start }, { updateEdition }] = await Promise.all([
          import("workflow/api"),
          import("@/workflows/update-edition"),
        ]);
        await start(updateEdition, [result.job.id]);
      } else {
        after(() => runLocalUpdate(result.job.id));
      }
    } catch {
      await failUpdate(result.job.id);
      throw new Error("No se pudo iniciar la actualización.");
    }
  }
  return result;
}
