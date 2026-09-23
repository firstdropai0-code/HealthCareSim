"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n/languageStore";

/**
 * Keeps `<html lang>` truthful. The root layout renders lang="en" because the
 * preference is client-side, so without this a reader who chose Hindi has
 * Devanagari served to a screen reader announcing English.
 *
 * Mounted once in the root layout rather than in AppShell: the auth pages
 * render without AppShell, and they are translated too.
 */
export function DocumentLanguage() {
  const language = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}
