import Link from "next/link";

interface PrimaryCtaProps {
  label: string;
  href: string;
}

export function PrimaryCta({ label, href }: PrimaryCtaProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-primary-500)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-400)]"
    >
      {label}
    </Link>
  );
}
