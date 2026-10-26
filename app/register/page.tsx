import { viewer } from "@/lib/backend";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/rules.mjs";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);
  if (await viewer()) redirect(next);
  redirect(`/?auth=register&next=${encodeURIComponent(next)}`);
}
