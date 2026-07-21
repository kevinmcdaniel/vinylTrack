export interface CallStepWarning { level?: 'inherent' | 'contextual'; text: string; }
export interface CallStepRowProps {
  /** Zero-padded step number, e.g. "01". */
  index?: string;
  /** Activator (Heads/Boys/Centers). Optional. */
  designator?: string;
  /** Call name (spoken). */
  name: string;
  /** Hand/repeat count, e.g. 3 or "4". Optional. */
  count?: number | string;
  /** Resolution state — drives the left border + row tint. Default 'resolved'. */
  resolution?: 'resolved' | 'unresolved' | 'ambiguous';
  /** Start formation (FASR) code. */
  formationIn?: string;
  /** End formation code. */
  formationOut?: string;
  /** Difficulty 0–5 (program-relative). */
  difficulty?: number;
  /** Hands used, e.g. "right, then left". */
  hands?: string;
  /** Beat count. */
  beats?: number;
  /** One-line technique note. */
  tech?: string;
  /** Optional warning chip. */
  warning?: CallStepWarning;
}
export function CallStepRow(props: CallStepRowProps): JSX.Element;
