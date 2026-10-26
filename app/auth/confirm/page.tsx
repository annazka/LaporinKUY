import type { Metadata } from "next";
import { EmailConfirmation } from "@/components/email-confirmation";
import "./confirmation.css";
export const metadata: Metadata = {
  title: "Konfirmasi email",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Confirmation() {
  return <EmailConfirmation />;
}
