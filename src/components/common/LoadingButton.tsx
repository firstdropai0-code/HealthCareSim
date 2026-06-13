import type { ButtonHTMLAttributes, ReactNode } from "react";

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
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 disabled:bg-slate-300 ${className}`}
    >
      {loading ? "Working..." : children}
    </button>
  );
}
