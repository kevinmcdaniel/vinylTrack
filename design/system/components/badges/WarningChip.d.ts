export interface WarningChipProps {
  /** 'inherent' (on the call, amber) or 'contextual' (this routine only, rose). */
  level?: 'inherent' | 'contextual';
  /** Warning text. */
  text: string;
}
export function WarningChip(props: WarningChipProps): JSX.Element;
