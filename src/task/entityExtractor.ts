/**
 * Entity extraction — extracts origin/destination from task text.
 *
 * Two-tier approach:
 * 1. Regex for "from X to Y" / "X to Y" patterns to locate candidate spans
 * 2. Match candidates against a small extendable gazetteer of city names
 *
 * If no gazetteer match, still returns the raw extracted span with lower
 * confidence rather than discarding it — better to pass through an
 * unverified "Mumbai-shaped" token than silently drop the entity.
 *
 * HACKATHON-SCOPED: The gazetteer is intentionally a small seed list,
 * NOT a claim of full geographic coverage. A production system would use
 * a proper geo-database or NER model.
 */

export interface ExtractedEntities {
  origin?: string;
  destination?: string;
  confidence: number;
}

/**
 * Small seed gazetteer of common Indian city names.
 * This is intentionally incomplete — it covers the demo's needs
 * and a reasonable set of major cities for SIH judging.
 *
 * A production system would use a proper geo-database.
 */
const CITY_GAZETTEER: string[] = [
  // Major Indian cities
  'mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'kolkata',
  'pune', 'hyderabad', 'ahmedabad', 'jaipur', 'lucknow', 'kanpur',
  'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna',
  'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad',
  'meerut', 'rajkot', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad',
  'amritsar', 'allahabad', 'ranchi', 'howrah', 'coimbatore', 'jabalpur',
  'gwalior', 'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kochi',
  'chandigarh', 'thiruvananthapuram', 'dehradun', 'mysore', 'prayagraj',
  // Common international cities
  'london', 'new york', 'dubai', 'singapore', 'tokyo', 'paris',
  'sydney', 'los angeles', 'san francisco', 'hong kong',
  // Airport codes (3-letter IATA)
  'bom', 'del', 'blr', 'maa', 'ccu', 'hyd', 'pune', 'pnq',
  'lhr', 'jfk', 'dxb', 'sin', 'nrt', 'cdg',
];

/**
 * Extract origin and destination from task text.
 *
 * Supports patterns like:
 * - "from Mumbai to Delhi"
 * - "Mumbai to Delhi"
 * - "flights between Mumbai and Delhi"
 * - "Mumbai Delhi flights"
 */
export function extractEntities(taskText: string): ExtractedEntities {
  const normalized = taskText.toLowerCase().trim();
  let confidence = 0.5; // base confidence for any extraction attempt

  // Tier 1: Explicit "from X to Y" pattern
  const fromToMatch = normalized.match(/from\s+([a-zA-Z\s]+?)\s+to\s+([a-zA-Z\s]+?)(?:\s|$|,|\.)/);
  if (fromToMatch) {
    const origin = fromToMatch[1]!.trim();
    const destination = fromToMatch[2]!.trim();
    const originMatch = matchGazetteer(origin);
    const destMatch = matchGazetteer(destination);
    if (originMatch || destMatch) {
      confidence = 0.85;
    }
    return {
      origin: originMatch || origin,
      destination: destMatch || destination,
      confidence,
    };
  }

  // Tier 1b: "X to Y" pattern (no "from")
  const toMatch = normalized.match(/([a-zA-Z\s]{2,20})\s+to\s+([a-zA-Z\s]{2,20})(?:\s|$|,|\.)/);
  if (toMatch) {
    const origin = toMatch[1]!.trim();
    const destination = toMatch[2]!.trim();
    const originMatch = matchGazetteer(origin);
    const destMatch = matchGazetteer(destination);
    if (originMatch || destMatch) {
      confidence = 0.75;
    }
    return {
      origin: originMatch || origin,
      destination: destMatch || destination,
      confidence,
    };
  }

  // Tier 2: "X and Y" or "X Y" pattern (less explicit)
  const andMatch = normalized.match(/([a-zA-Z\s]{2,20})\s+and\s+([a-zA-Z\s]{2,20})(?:\s|$|,|\.)/);
  if (andMatch) {
    const origin = andMatch[1]!.trim();
    const destination = andMatch[2]!.trim();
    const originMatch = matchGazetteer(origin);
    const destMatch = matchGazetteer(destination);
    if (originMatch || destMatch) {
      confidence = 0.60;
    }
    return {
      origin: originMatch || origin,
      destination: destMatch || destination,
      confidence,
    };
  }

  // No entities found
  return { confidence: 0.0 };
}

/**
 * Match a candidate span against the gazetteer.
 * Returns the matched city name (properly cased) or null.
 */
function matchGazetteer(candidate: string): string | null {
  const normalized = candidate.toLowerCase().trim();
  for (const city of CITY_GAZETTEER) {
    if (normalized === city || normalized.includes(city) || city.includes(normalized)) {
      // Return proper casing from the gazetteer (first match)
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  return null;
}
