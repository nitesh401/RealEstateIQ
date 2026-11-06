export type PropertyType = 'plot' | 'house' | 'apartment' | 'commercial';
export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'unknown';
export type EvidenceKind = 'transaction' | 'asking';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type Verdict = 'BUY' | 'BUY AFTER NEGOTIATION' | 'NEGOTIATE' | 'HOLD' | 'AVOID';

export type LocationSource = 'search' | 'marker' | 'manual' | 'device' | 'none';

export interface LocationInput {
  country: string;
  state: string;
  city: string;
  locality: string;
  project: string;
  pincode: string;
  lat: number | null;
  lon: number | null;
  displayName: string;
  source: LocationSource;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  mime: string;
  category: 'photo' | 'floor_plan' | 'site_plan' | 'title_deed' | 'encumbrance' | 'layout_approval' | 'diversion' | 'tax_receipt' | 'rera' | 'other';
}

export interface PropertyInput {
  location: LocationInput;
  type: PropertyType;
  // pricing
  pricingArea: number | null; // sqft actually used to price the property
  pricingAreaBasis: string; // human label, e.g. "Plot area", "Super built-up area"
  askingRate: number | null; // Rs / sqft
  askingTotal: number | null; // Rs
  // plot
  plotLength: number | null;
  plotWidth: number | null;
  corner: boolean;
  roadWidthFt: number | null;
  roadType: 'main' | 'internal' | 'unknown';
  township: boolean;
  plotNumber: string;
  approvedLayout: 'yes' | 'no' | 'unknown';
  // apartment
  carpetArea: number | null;
  builtUpArea: number | null;
  superBuiltUpArea: number | null;
  floor: number | null;
  totalFloors: number | null;
  bedrooms: number | null;
  parking: boolean;
  lift: boolean;
  amenities: string;
  maintenanceMonthly: number | null;
  // house
  landArea: number | null;
  houseFloors: number | null;
  constructionQuality: 'basic' | 'standard' | 'premium' | 'unknown';
  // commercial
  frontageFt: number | null;
  usage: string;
  rentalMonthly: number | null;
  // shared
  ageYears: number | null;
  facing: Direction;
  // vastu
  entrance: Direction;
  roadDirection: Direction;
  plotShape: 'square' | 'rectangle' | 'irregular' | 'l_shaped' | 'triangular' | 'unknown';
  northReference: 'compass' | 'map' | 'surveyor' | 'unknown';
  zones: { kitchen: Direction; masterBedroom: Direction; pooja: Direction; toilet: Direction };
  // extra
  saleKind: 'resale' | 'new' | 'under_construction' | 'unknown';
  possession: 'ready' | 'within_6m' | 'later' | 'unknown';
  negotiability: 'firm' | 'some' | 'high' | 'unknown';
  purpose: 'self_use' | 'investment' | 'rental';
  budget: number | null;
  // market evidence
  guidelineRate: number | null; // Rs/sqft, user-entered from official guideline schedule
  guidelineSource: string;
  comparables: Comparable[];
  attachments: AttachmentMeta[];
  legal: Record<string, LegalStatus>;
  constructionEstimate: { enabled: boolean; builtUpSqft: number | null; ratePerSqft: number | null };
}

export interface Comparable {
  id: string;
  label: string;
  propertyType: PropertyType;
  kind: EvidenceKind;
  ratePerSqft: number;
  areaSqft?: number;
  distanceKm?: number;
  observedOn: string; // ISO date YYYY-MM-DD
  sourceName: string;
  sourceUrl?: string;
  roadWidthFt?: number;
  corner?: boolean;
  township?: boolean;
  verified?: boolean; // the user confirmed this against a primary document / the live listing
  isDemo?: boolean;
}

export type LegalStatus = 'not_started' | 'document_available' | 'preliminary' | 'lawyer_verified' | 'issue_found';

export interface Assumptions {
  stateCode: string;
  stampDutyPct: number;
  registrationPct: number;
  ratesAsOf: string;
  ratesSource: string;
  ratesVerified: boolean;
  brokeragePct: number;
  legalFeeFlat: number;
  otherCostsFlat: number;
  gstPct: number; // applied only to under-construction purchases
  askingDiscountPct: number; // optional haircut applied to asking-price comparables
  maxCompAgeDays: number;
  maxCompDistanceKm: number;
  roadAdjPctPer10ft: number;
  cornerAdjPct: number;
  townshipAdjPct: number;
  marketEndpoint: string;
}

export interface ExcludedComp {
  comp: Comparable;
  reason: string;
}
export interface UsedComp {
  comp: Comparable;
  adjustedRate: number;
  weight: number;
  ageDays: number;
  factors: { recency: number; distance: number; evidence: number; size: number };
  adjustmentsApplied: string[];
}

export interface ValuationResult {
  area: number;
  askingRate: number;
  askingTotal: number;
  estimated: boolean; // true if a market estimate could be computed from comparables
  preliminary: boolean;
  fairRate: number | null;
  lowRate: number | null;
  highRate: number | null;
  fairValue: number | null;
  lowValue: number | null;
  highValue: number | null;
  difference: number | null; // asking - fair
  differencePct: number | null; // +ve = premium
  negotiationPrice: number | null;
  maxPurchasePrice: number | null;
  guidelineValue: number | null;
  guidelineRate: number | null;
  used: UsedComp[];
  excluded: ExcludedComp[];
  confidence: Confidence;
  confidenceReasons: string[];
  dispersionCv: number | null;
  medianAgeDays: number | null;
  demoData: boolean;
  evidenceSummary: { transactions: number; asking: number; verified: number };
  notes: string[];
}

export interface CostLine {
  label: string;
  amount: number;
  note?: string;
}
export interface CostResult {
  basePrice: number;
  duties: CostLine[];
  additional: CostLine[];
  additionalTotal: number;
  totalAcquisition: number;
  dutyBase: number;
  indicative: boolean;
  ratesAsOf: string;
  ratesSource: string;
  warnings: string[];
}

export interface VastuFinding {
  tone: 'positive' | 'concern' | 'note';
  text: string;
}
export interface VastuResult {
  score: number | null;
  label: string;
  findings: VastuFinding[];
  improvements: string[];
  principles: string[];
  breakdown: { name: string; score: number | null; weight: number }[];
  disclaimer: string;
}

export type AmenityCategory =
  | 'school' | 'hospital' | 'shopping' | 'bus' | 'railway' | 'airport' | 'highway' | 'it_park' | 'water' | 'development';

export interface Place {
  id: string;
  category: AmenityCategory;
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  tags?: Record<string, string>;
}
export interface LocationIntel {
  fetchedAt: string;
  radiusM: number;
  places: Place[];
  errors: string[];
  partial: boolean;
  source: string;
  sourceUrl: string;
  attempted: boolean;
}

export interface LegalItem {
  id: string;
  title: string;
  critical: boolean;
  appliesTo: PropertyType[];
  why: string;
  howToVerify: string;
}

export interface RiskItem {
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
}

export interface Recommendation {
  verdict: Verdict;
  headline: string;
  reasons: string[];
  unresolved: string[];
  scores: { label: string; value: number | null; note: string }[];
  investment: { suitability: string; points: string[] };
  risks: RiskItem[];
}

export interface DataSourceRecord {
  name: string;
  url?: string;
  retrievedAt: string;
  status: 'used' | 'unavailable' | 'user_supplied' | 'not_integrated';
  detail: string;
}

export interface AnalysisReport {
  id: string;
  createdAt: string;
  title: string;
  input: PropertyInput;
  assumptions: Assumptions;
  valuation: ValuationResult;
  costs: CostResult;
  vastu: VastuResult;
  intel: LocationIntel | null;
  recommendation: Recommendation;
  sources: DataSourceRecord[];
  marketFetchError: string | null;
  appVersion: string;
}
