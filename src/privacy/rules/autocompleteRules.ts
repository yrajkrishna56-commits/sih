/**
 * Autocomplete rules — data table.
 * Maps `autocomplete` attribute values to PII classifications.
 */

import type { PIIType, DetectionMethod } from '../privacyTypes';
import { WEIGHT_STRONG } from '../confidence';

export interface AutocompleteRule {
  valuePattern: string;
  piiType: PIIType;
  method: DetectionMethod;
  weight: number;
}

export const AUTOCOMPLETE_RULES: AutocompleteRule[] = [
  { valuePattern: 'email',           piiType: 'EMAIL',           method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'tel',             piiType: 'PHONE',           method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'name',            piiType: 'PERSON_NAME',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'given-name',      piiType: 'PERSON_NAME',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'family-name',     piiType: 'PERSON_NAME',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'street-address',  piiType: 'ADDRESS',         method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'address-line1',   piiType: 'ADDRESS',         method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'cc-number',       piiType: 'CARD_NUMBER',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'cc-exp',          piiType: 'CARD_EXPIRY',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'cc-exp-month',    piiType: 'CARD_EXPIRY',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'cc-exp-year',     piiType: 'CARD_EXPIRY',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'cc-csc',          piiType: 'CVV',             method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'cc-name',         piiType: 'PERSON_NAME',     method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'bday',            piiType: 'DATE_OF_BIRTH',   method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'new-password',    piiType: 'PASSWORD',        method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
  { valuePattern: 'current-password', piiType: 'PASSWORD',       method: 'AUTOCOMPLETE', weight: WEIGHT_STRONG },
];
