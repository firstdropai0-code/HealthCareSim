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
      className={`btn-shine inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,118,110,0.32)] disabled:translate-y-0 disabled:bg-slate-300 disabled:bg-none disabled:text-slate-500 disabled:shadow-none ${className}`}
    >
      {loading ? "Working..." : children}
    </button>
  );
}
