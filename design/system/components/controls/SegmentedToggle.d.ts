export type SegmentedOption = string | { value: string; label: string };
export interface SegmentedToggleProps {
  /** Options as strings or {value,label}. */
  options: SegmentedOption[];
  /** Currently-selected value. */
  value: string;
  /** Called with the new value on click. */
  onChange?: (value: string) => void;
}
export function SegmentedToggle(props: SegmentedToggleProps): JSX.Element;
