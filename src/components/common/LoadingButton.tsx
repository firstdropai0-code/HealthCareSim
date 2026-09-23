"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useT } from "@/lib/i18n/strings";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  children: ReactNode;
};

export function LoadingButton({
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: LoadingButtonProps) {
  const t = useT();

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`btn-editorial btn-editorial--accent ${className}`}
    >
      {loading ? t("common.working") : children}
    </button>
  );
}
