/**
 * Concept rules — data table backing conceptTagger.
 *
 * Maps keyword substrings in element text/label/ariaLabel to DomainConcepts.
 * Same convention as Phase 2's rule tables: data, not code branches.
 *
 * HACKATHON-SCOPED: This vocabulary is intentionally flight-booking-specific.
 * A production system would need a more extensible concept taxonomy.
 */

import type { DomainConcept } from './taskTypes';

export interface ConceptRule {
  /** Keywords to match (case-insensitive, against normalized text) */
  keywords: string[];
  /** The DomainConcept this maps to */
  concept: DomainConcept;
  /** Weight for this match (0–1) */
  weight: number;
}

/**
 * Rules for mapping element text/label content to domain concepts.
 * Checked in order; first match wins per element.
 */
export const CONCEPT_RULES: ConceptRule[] = [
  // Price-related
  { keywords: ['price', 'fare', 'cost', '₹', '$', 'usd', 'inr'], concept: 'PRICE', weight: 0.50 },

  // Flight number
  { keywords: ['sb ', 'ai ', '6e ', 'sg ', 'flight'], concept: 'FLIGHT_NUMBER', weight: 0.25 },

  // Airline
  { keywords: ['airways', 'air india', 'indigo', 'spicejet', 'skybook'], concept: 'AIRLINE', weight: 0.25 },

  // Departure time
  { keywords: ['departure', 'departs', 'depart'], concept: 'DEPARTURE_TIME', weight: 0.50 },

  // Arrival time
  { keywords: ['arrival', 'arrives', 'arrive'], concept: 'ARRIVAL_TIME', weight: 0.50 },

  // Duration — after normalization, hyphens become spaces, so "non-stop" → "non stop"
  { keywords: ['duration', 'stop', 'layover'], concept: 'DURATION', weight: 0.25 },

  // Origin
  { keywords: ['from', 'origin', 'departure city'], concept: 'ORIGIN', weight: 0.50 },

  // Destination
  { keywords: ['destination', 'arrival city', 'going to', 'bound for'], concept: 'DESTINATION', weight: 0.50 },

  // Travel date
  { keywords: ['date', 'travel date', 'departure date', 'journey date'], concept: 'TRAVEL_DATE', weight: 0.50 },

  // Selection control (buttons)
  { keywords: ['select flight', 'select', 'choose', 'book'], concept: 'SELECTION_CONTROL', weight: 0.50 },

  // Search control
  { keywords: ['search flight', 'search', 'find flight', 'find'], concept: 'SEARCH_CONTROL', weight: 0.50 },

  // Passenger name
  { keywords: ['full name', 'passenger name', 'first name', 'last name', 'name on card', 'cardholder'], concept: 'PASSENGER_NAME', weight: 0.25 },

  // Passenger email
  { keywords: ['email', 'e-mail'], concept: 'PASSENGER_EMAIL', weight: 0.25 },

  // Passenger phone
  { keywords: ['phone', 'mobile', 'telephone', 'contact number'], concept: 'PASSENGER_PHONE', weight: 0.25 },

  // Passport
  { keywords: ['passport', 'passport number'], concept: 'PASSPORT', weight: 0.25 },

  // Payment card
  { keywords: ['card number', 'credit card', 'debit card', 'card no'], concept: 'PAYMENT_CARD', weight: 0.25 },

  // CVV
  { keywords: ['cvv', 'cvc', 'security code', 'card verification'], concept: 'PAYMENT_CVV', weight: 0.25 },

  // Payment expiry
  { keywords: ['expiry', 'expiration', 'exp date', 'valid thru'], concept: 'PAYMENT_EXPIRY', weight: 0.25 },
];

/**
 * Input-type-to-concept mapping for elements where text/label matching
 * isn't sufficient (e.g. type="email" → PASSENGER_EMAIL).
 */
export interface InputTypeConceptRule {
  typePattern: string;
  concept: DomainConcept;
  weight: number;
}

export const INPUT_TYPE_CONCEPT_RULES: InputTypeConceptRule[] = [
  { typePattern: 'email',   concept: 'PASSENGER_EMAIL',  weight: 0.50 },
  { typePattern: 'password', concept: 'PAYMENT_CVV',     weight: 0.25 },  // password fields with CVV labels
  { typePattern: 'tel',     concept: 'PASSENGER_PHONE',  weight: 0.50 },
];

/**
 * Autocomplete-to-concept mapping.
 */
export interface AutocompleteConceptRule {
  valuePattern: string;
  concept: DomainConcept;
  weight: number;
}

export const AUTOCOMPLETE_CONCEPT_RULES: AutocompleteConceptRule[] = [
  { valuePattern: 'email',           concept: 'PASSENGER_EMAIL',  weight: 0.50 },
  { valuePattern: 'tel',             concept: 'PASSENGER_PHONE',  weight: 0.50 },
  { valuePattern: 'name',            concept: 'PASSENGER_NAME',   weight: 0.50 },
  { valuePattern: 'given-name',      concept: 'PASSENGER_NAME',   weight: 0.50 },
  { valuePattern: 'family-name',     concept: 'PASSENGER_NAME',   weight: 0.50 },
  { valuePattern: 'cc-number',       concept: 'PAYMENT_CARD',     weight: 0.50 },
  { valuePattern: 'cc-exp',          concept: 'PAYMENT_EXPIRY',   weight: 0.50 },
  { valuePattern: 'cc-csc',          concept: 'PAYMENT_CVV',      weight: 0.50 },
  { valuePattern: 'cc-name',         concept: 'PASSENGER_NAME',   weight: 0.50 },
  { valuePattern: 'bday',            concept: 'UNKNOWN',          weight: 0.25 },
  { valuePattern: 'new-password',    concept: 'PAYMENT_CVV',      weight: 0.25 },
  { valuePattern: 'current-password', concept: 'PAYMENT_CVV',     weight: 0.25 },
];

/**
 * Tag-to-concept mapping for structural elements (buttons, selects).
 */
export interface TagConceptRule {
  tagPatterns: string[];
  textKeywords: string[];
  concept: DomainConcept;
  weight: number;
}

export const TAG_CONCEPT_RULES: TagConceptRule[] = [
  // Select elements for origin/destination
  {
    tagPatterns: ['SELECT'],
    textKeywords: ['from'],
    concept: 'ORIGIN',
    weight: 0.50,
  },
  {
    tagPatterns: ['SELECT'],
    textKeywords: ['to'],
    concept: 'DESTINATION',
    weight: 0.50,
  },
  // Buttons
  {
    tagPatterns: ['BUTTON'],
    textKeywords: ['search', 'find', 'lookup'],
    concept: 'SEARCH_CONTROL',
    weight: 0.50,
  },
  {
    tagPatterns: ['BUTTON'],
    textKeywords: ['select', 'choose', 'book', 'confirm'],
    concept: 'SELECTION_CONTROL',
    weight: 0.50,
  },
];
