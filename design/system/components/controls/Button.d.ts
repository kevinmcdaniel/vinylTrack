import React from 'react';

export interface ButtonProps {
  children?: React.ReactNode;
  /** primary (accent fill) | secondary (outline) | ghost (accent text) | success. Default primary. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'success';
  /** sm | md | lg. Default md. */
  size?: 'sm' | 'md' | 'lg';
  /** Optional leading glyph/icon node. */
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}
export function Button(props: ButtonProps): JSX.Element;
