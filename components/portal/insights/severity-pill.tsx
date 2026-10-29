

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-[2px] bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {category}
    </span>
  );
}
