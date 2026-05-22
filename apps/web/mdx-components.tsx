import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import Link from "next/link";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: (props: ComponentPropsWithoutRef<"h1">) => (
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl" {...props} />
    ),
    h2: (props: ComponentPropsWithoutRef<"h2">) => (
      <h2 className="mt-10 text-2xl font-semibold tracking-tight" {...props} />
    ),
    h3: (props: ComponentPropsWithoutRef<"h3">) => (
      <h3 className="mt-6 text-lg font-medium" {...props} />
    ),
    p: (props: ComponentPropsWithoutRef<"p">) => (
      <p className="mt-4 leading-7 text-muted-foreground" {...props} />
    ),
    ul: (props: ComponentPropsWithoutRef<"ul">) => (
      <ul className="mt-4 list-disc space-y-1 pl-6 text-muted-foreground" {...props} />
    ),
    ol: (props: ComponentPropsWithoutRef<"ol">) => (
      <ol className="mt-4 list-decimal space-y-1 pl-6 text-muted-foreground" {...props} />
    ),
    li: (props: ComponentPropsWithoutRef<"li">) => (
      <li className="leading-7" {...props} />
    ),
    a: ({ href = "#", ...rest }: ComponentPropsWithoutRef<"a">) => (
      <Link href={href} className="text-foreground underline underline-offset-4">
        {rest.children}
      </Link>
    ),
    blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote className="mt-6 border-l-2 border-border pl-4 text-muted-foreground" {...props} />
    ),
    table: (props: ComponentPropsWithoutRef<"table">) => (
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    th: (props: ComponentPropsWithoutRef<"th">) => (
      <th className="border-b border-border px-3 py-2 text-left font-medium" {...props} />
    ),
    td: (props: ComponentPropsWithoutRef<"td">) => (
      <td className="border-b border-border/60 px-3 py-2 align-top text-muted-foreground" {...props} />
    ),
    hr: () => <hr className="my-10 border-border" />,
    ...components,
  };
}
