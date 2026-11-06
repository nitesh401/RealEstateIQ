import type { LegalItem, LegalStatus, PropertyInput, PropertyType } from './types';

const ALL: PropertyType[] = ['plot', 'house', 'apartment', 'commercial'];

/** Madhya Pradesh oriented due-diligence checklist. Items are guidance, not legal advice. */
export const LEGAL_ITEMS: LegalItem[] = [
  { id: 'title', title: 'Title deed & seller authority', critical: true, appliesTo: ALL, why: 'Confirms the seller actually owns and can transfer the property.', howToVerify: 'Lawyer examines original deed(s), seller ID and, if applicable, power of attorney validity.' },
  { id: 'chain', title: 'Previous ownership chain (30 years where possible)', critical: true, appliesTo: ALL, why: 'Gaps or disputed transfers in the chain are a common source of title defects.', howToVerify: 'Collect prior registered deeds; lawyer checks continuity, partitions, inheritance and releases.' },
  { id: 'ec', title: 'Encumbrance verification', critical: true, appliesTo: ALL, why: 'Reveals registered mortgages, charges and some transfers.', howToVerify: 'Search registry records through the MP IGR (SAMPADA) system or the Sub-Registrar office for the period concerned.' },
  { id: 'records', title: 'Land records (khasra / khatauni / B-1 / map)', critical: true, appliesTo: ['plot', 'house', 'commercial'], why: 'Confirms recorded ownership, land type and area on revenue records.', howToVerify: 'Check the official MP land-records (Bhulekh) service and the Tehsil/Patwari records; match survey numbers.' },
  { id: 'diversion', title: 'Diversion order / land-use conversion', critical: true, appliesTo: ['plot', 'house', 'commercial'], why: 'Agricultural land generally needs formal diversion before residential/commercial use.', howToVerify: 'Obtain the diversion order from the revenue authority and match survey numbers and area.' },
  { id: 'layout', title: 'Approved layout / development permission', critical: true, appliesTo: ['plot', 'house'], why: 'Unapproved layouts risk non-sanctioned construction and utility denial.', howToVerify: 'Request the sanctioned layout plan from the colonizer and confirm with the town & country planning / municipal body.' },
  { id: 'colonizer', title: 'Colonizer / developer licence & permissions', critical: false, appliesTo: ['plot', 'house', 'apartment', 'commercial'], why: 'Developers selling plots in colonies need statutory permissions.', howToVerify: 'Ask for the colonizer licence / development permission and cross-check with the issuing authority.' },
  { id: 'rera', title: 'RERA registration (where applicable)', critical: true, appliesTo: ['plot', 'apartment', 'commercial', 'house'], why: 'Registered projects must disclose approvals, timelines and escrow information.', howToVerify: 'Search the project on the Madhya Pradesh RERA website. Not all resale properties fall under RERA.' },
  { id: 'municipal', title: 'Municipal approvals (building permission, completion / occupancy)', critical: false, appliesTo: ['house', 'apartment', 'commercial'], why: 'Missing completion or occupancy certificates can block utilities, loans and resale.', howToVerify: 'Obtain sanctioned plan, completion/occupancy certificate from the municipal body; compare with as-built.' },
  { id: 'tax', title: 'Property tax receipts & no-dues', critical: false, appliesTo: ALL, why: 'Unpaid dues may attach to the property.', howToVerify: 'Get latest paid receipts and a dues check from the municipal body; also society/utility no-dues.' },
  { id: 'landuse', title: 'Land-use classification vs master plan', critical: true, appliesTo: ['plot', 'house', 'commercial'], why: 'Master-plan zoning decides what may legally be built.', howToVerify: 'Check the city development/master plan zoning for the exact survey number.' },
  { id: 'litigation', title: 'Litigation & court-record search', critical: true, appliesTo: ALL, why: 'Pending suits, attachments or lis pendens can void or freeze a transfer.', howToVerify: 'Lawyer searches court records, public notice and, where relevant, DRT/consumer forums.' },
  { id: 'registry', title: 'Registry records & mutation after purchase', critical: false, appliesTo: ALL, why: 'Registration alone does not update revenue/municipal records.', howToVerify: 'Plan mutation (name transfer) in revenue/municipal records after registry.' },
  { id: 'society', title: 'Society NOC / share certificate / maintenance dues', critical: false, appliesTo: ['apartment'], why: 'Confirms the housing society allows transfer and dues are cleared.', howToVerify: 'Obtain NOC and a no-dues certificate from the society/association.' },
  { id: 'loan', title: 'Existing bank loan / lien (if any)', critical: true, appliesTo: ALL, why: 'A mortgaged property needs lender release at sale.', howToVerify: 'Ask seller for loan statement and original-document custody details; require lender NOC and release.' },
  { id: 'survey', title: 'Physical boundary survey & possession check', critical: false, appliesTo: ['plot', 'house', 'commercial'], why: 'Matches physical boundaries, area and encroachment risk to documents.', howToVerify: 'Licensed surveyor measures the site; confirm road access and easements on the ground.' },
];

export const STATUS_LABEL: Record<LegalStatus, string> = {
  not_started: 'Not started',
  document_available: 'Document seen (not verified)',
  preliminary: 'Preliminary check done',
  lawyer_verified: 'Verified by lawyer / official record',
  issue_found: 'Issue found',
};

export const STATUS_HELP =
  'A document being present or uploaded is NOT verification. "Verified" should be used only after a qualified lawyer or an official record confirms the item.';

export function itemsFor(type: PropertyType): LegalItem[] {
  return LEGAL_ITEMS.filter((i) => i.appliesTo.includes(type));
}

export function legalStatusOf(input: PropertyInput, id: string): LegalStatus {
  return input.legal[id] ?? 'not_started';
}

export interface LegalSummary {
  total: number;
  verified: number;
  criticalTotal: number;
  criticalVerified: number;
  criticalOpen: LegalItem[];
  issues: LegalItem[];
}

export function summariseLegal(input: PropertyInput): LegalSummary {
  const items = itemsFor(input.type);
  const st = (i: LegalItem) => legalStatusOf(input, i.id);
  const critical = items.filter((i) => i.critical);
  return {
    total: items.length,
    verified: items.filter((i) => st(i) === 'lawyer_verified').length,
    criticalTotal: critical.length,
    criticalVerified: critical.filter((i) => st(i) === 'lawyer_verified').length,
    criticalOpen: critical.filter((i) => st(i) !== 'lawyer_verified'),
    issues: items.filter((i) => st(i) === 'issue_found'),
  };
}

/** Map an uploaded document category to the checklist item it relates to – presence only, never verification. */
export const ATTACHMENT_TO_ITEM: Record<string, string | undefined> = {
  title_deed: 'title', encumbrance: 'ec', layout_approval: 'layout', diversion: 'diversion', tax_receipt: 'tax', rera: 'rera',
};
