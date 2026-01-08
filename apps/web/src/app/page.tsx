'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-foreground relative overflow-hidden">

      <div className="max-w-5xl w-full text-center space-y-8 z-10">
        <h1 className="text-5xl tracking-tight sm:text-7xl">
          Praxis
        </h1>

        <div className="flex flex-wrap items-top justify-center">
          <Link
            href="/login"
            className="rounded-md bg-primary px-3.5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}