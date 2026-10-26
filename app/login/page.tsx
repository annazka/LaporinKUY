import { viewer } from "@/lib/backend";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/rules.mjs";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await viewer()) redirect(next);
  redirect(`/?auth=login&next=${encodeURIComponent(next)}`);
}
