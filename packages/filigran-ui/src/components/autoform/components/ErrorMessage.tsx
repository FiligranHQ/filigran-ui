import { Label } from '../../clients';
import type { FunctionComponent } from 'react';

export const ErrorMessage: FunctionComponent<{ error: string }> = ({ error }) => (
  <Label className="text-destructive">{error}</Label>
);
