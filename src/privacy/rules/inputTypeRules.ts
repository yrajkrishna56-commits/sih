/**
 * Input type rules — data table, not code branches.
 * Each rule maps an input's `type` attribute to a PII classification.
 */

import type { PIIType, DetectionMethod } from '../privacyTypes';
import { WEIGHT_STRONG } from '../confidence';

export interface InputTypeRule {
  typePattern: string;
  piiType: PIIType;
  method: DetectionMethod;
  weight: number;
}

export const INPUT_TYPE_RULES: InputTypeRule[] = [
  { typePattern: 'email',   piiType: 'EMAIL',       method: 'INPUT_TYPE', weight: WEIGHT_STRONG },
  { typePattern: 'password', piiType: 'PASSWORD',    method: 'INPUT_TYPE', weight: WEIGHT_STRONG },
  { typePattern: 'tel',     piiType: 'PHONE',        method: 'INPUT_TYPE', weight: WEIGHT_STRONG },
  // Note: type="date" is NOT classified here — requires label context
  // to distinguish DOB from travel dates. Handled by genericClassifier.
];
