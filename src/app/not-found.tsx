import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-canvas-banded text-ink-tertiary">
        <Compass className="h-5 w-5" aria-hidden />
      </div>
      <h1 className="mt-4 text-display font-semibold text-ink-primary">
        That page isn't here.
      </h1>
      <p className="mt-3 text-body text-ink-secondary">
        It may have moved, or the link might be stale. Head back to start.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 w-fit items-center rounded-md bg-primary px-6 text-body font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        Back to start
      </Link>
      <p className="mt-8 text-caption text-ink-tertiary">
        In a crisis, call{" "}
        <a href="tel:988" className="font-semibold text-crisis hover:underline">
          988
        </a>{" "}
        and press 1 — Veterans Crisis Line, 24/7.
      </p>
    </div>
  );
}
