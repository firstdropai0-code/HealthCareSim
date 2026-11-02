import { notFound } from "next/navigation";
import { PresenceLab } from "./PresenceLab";

/**
 * Dev-only test bench for webcam tracking: does it tell looking at the patient
 * from looking away, on a real laptop, before anything is built on top of it?
 * The same idea as scripts/probeVoiceTone.mjs, which gates tone feedback.
 *
 * A server component, unlike every other page, purely so production can refuse
 * the route before any of it reaches a browser.
 */
export default function PresenceLabPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <PresenceLab />;
}
