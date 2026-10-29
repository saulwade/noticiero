import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { localHost } from "@/lib/access";
import { getDashboardData } from "@/db/repository";
import { demoData } from "@/lib/demo-data";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const host = (await headers()).get("host");
  if (!localHost(host)) {
    if (
      !process.env.AUTH_SECRET ||
      !process.env.AUTH_ALLOWED_GITHUB_ID ||
      !(await auth())?.user
    )
      redirect("/login");
  }
  const params = await searchParams;
  const data = params.demo === "1" ? demoData() : await getDashboardData();
  return <Dashboard key={data.demo ? "demo" : "live"} initialData={data} />;
}
