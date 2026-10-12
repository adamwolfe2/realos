// SidebarCard — labeled card used in the lead detail sidebar.
export function SidebarCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="ls-card p-4">
      <p className="ls-eyebrow mb-3">
        {label}
      </p>
      {children}
    </div>
  );
}
