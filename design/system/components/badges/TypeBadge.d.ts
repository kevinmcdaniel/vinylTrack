export type TypeBadgeKind = 'call' | 'activator' | 'filler' | 'tip' | 'warning' | 'recovery';
export interface TypeBadgeProps {
  /** Parser classification of the line. Default 'call'. */
  kind?: TypeBadgeKind;
}
export function TypeBadge(props: TypeBadgeProps): JSX.Element;
