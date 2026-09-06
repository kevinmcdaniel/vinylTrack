export default function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-black/15 p-6 text-center text-sm opacity-70 dark:border-white/20">{children}</p>;
}
