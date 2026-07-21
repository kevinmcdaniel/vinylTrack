export interface GetOutCardProps {
  /** Eyebrow label. Default "GET-OUT". */
  label?: string;
  /** The resolving call, e.g. "Allemande Left". */
  name: string;
  /** Supporting note. */
  note?: string;
  /** Where it resolves from, e.g. "from Corner Box". */
  from?: string;
}
export function GetOutCard(props: GetOutCardProps): JSX.Element;
