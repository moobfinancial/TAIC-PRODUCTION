import Link from 'next/link';
import { Rocket } from 'lucide-react';

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary/90 transition-colors">
      <Rocket className="h-7 w-7" />
      <h1 className="text-2xl font-headline font-bold">
        TAIC
      </h1>
    </Link>
  );
}
