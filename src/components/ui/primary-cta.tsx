import Link from "next/link";
import { Button } from "./button";

/** @deprecated Use <Button variant="primary" asChild><Link href={href}>{label}</Link></Button> — removed in 16G */
interface PrimaryCtaProps {
  label: string;
  href: string;
}

export function PrimaryCta({ label, href }: PrimaryCtaProps) {
  return (
    <Button variant="primary" asChild>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
