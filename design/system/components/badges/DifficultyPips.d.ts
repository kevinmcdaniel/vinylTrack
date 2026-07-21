export interface DifficultyPipsProps {
  /** Number of lit pips, 0–max. Difficulty relative to the program floor. */
  level?: number;
  /** Total pips rendered. Default 5. */
  max?: number;
  /** Pip width in px. Default 4. */
  width?: number;
  /** Pip height in px. Default 13. */
  height?: number;
}
export function DifficultyPips(props: DifficultyPipsProps): JSX.Element;
