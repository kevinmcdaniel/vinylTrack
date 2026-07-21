export interface FormationDancer {
  /** 'boy' = square, 'girl' = circle. */
  shape: 'boy' | 'girl';
  /** Facing direction; omit for no arrow. */
  dir?: 'up' | 'down';
  /** Draw a hand-link bar to the next dancer in the row. */
  link?: boolean;
}
export interface FormationDiagramProps {
  /** Rows of dancers, top to bottom. */
  rows: FormationDancer[][];
  /** Marker size in px. Default 34. */
  size?: number;
}
export function FormationDiagram(props: FormationDiagramProps): JSX.Element;
