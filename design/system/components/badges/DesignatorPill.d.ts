export interface DesignatorPillProps {
  /** Activator text, e.g. "Heads", "Boys", "Centers". Renders nothing if empty. */
  text?: string | null;
  /** 'editor' = mono uppercase terracotta (default); 'inline' = muted display prefix for live lines. */
  tone?: 'editor' | 'inline';
}
export function DesignatorPill(props: DesignatorPillProps): JSX.Element | null;
