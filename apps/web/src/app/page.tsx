'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground relative overflow-hidden">
      <div className="max-w-5xl w-full text-center space-y-8 z-10">
        <h1 className="text-5xl tracking-tight sm:text-7xl font-bold">
          Praxis
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg" className="text-base font-semibold shadow-lg">
            <Link href="/login">
              Sign In
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-base font-semibold shadow-sm">
            <Link href="/signup">
              Get Started
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}