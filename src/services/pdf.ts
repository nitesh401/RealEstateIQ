import { jsPDF } from 'jspdf';
import type { AnalysisReport, Verdict } from '../lib/types';
import { DIR_LABEL, TYPE_LABEL, fmtDate, fmtDateTime, fmtNum, fmtPct, fmtRs, fmtWords } from '../lib/format';
import { itemsFor, legalStatusOf, STATUS_LABEL, STATUS_HELP, ATTACHMENT_TO_ITEM } from '../lib/legal';
import { CATEGORY_META, CATEGORY_ORDER, byCategory, locationScore } from '../lib/location';
import { bearingDeg } from '../lib/geo';
import { resolveAsking } from '../lib/valuation';

/** Standard PDF fonts have no rupee glyph or smart punctuation; map to safe Latin-1. */
export function pdfSafe(s: string): string {
  return s
    .replace(/₹/g, 'Rs ').replace(/[–—−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...')
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~').replace(/→/g, '->').replace(/[✓✔]/g, 'Yes').replace(/□/g, '[ ]')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g, '?');
}

const C = {
  navy: [11, 16, 32] as const, ink: [30, 38, 56] as const, gold: [176, 128, 52] as const, muted: [110, 120, 138] as const,
  line: [214, 219, 228] as const, soft: [243, 245, 249] as const, red: [190, 70, 50] as const, green: [30, 140, 100] as const, amber: [196, 130, 20] as const,
};
type RGB = readonly [number, number, number];
const VERDICT_COLOR: Record<Verdict, RGB> = { BUY: C.green, 'BUY AFTER NEGOTIATION': [60, 150, 110], NEGOTIATE: C.amber, HOLD: [90, 110, 160], AVOID: C.red };

export function buildPdf(rep: AnalysisReport): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const W = 210, H = 297, M = 16, CW = W - M * 2;
  let y = 0;
  const v = rep.valuation, inp = rep.input, rec = rep.recommendation, cost = rep.costs;
  const isDemo = v.demoData;
  const T = (s: string) => pdfSafe(s);
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

  const newPage = () => {
    doc.addPage();
    y = 22;
  };
  const need = (h: number) => { if (y + h > H - 20) newPage(); };

  const wrap = (s: string, w: number, size: number): string[] => { doc.setFontSize(size); return doc.splitTextToSize(T(s), w) as string[]; };

  function h1(num: string, title: string) {
    need(18);
    y += 4;
    fill(C.gold); doc.rect(M, y - 4.2, 1.6, 6.4, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); color(C.navy);
    doc.text(T(`${num}. ${title}`), M + 4, y);
    y += 3; stroke(C.line); doc.setLineWidth(0.2); doc.line(M, y, W - M, y); y += 5;
  }
  function para(s: string, opts: { size?: number; bold?: boolean; col?: RGB; indent?: number; gap?: number } = {}) {
    const size = opts.size ?? 9.5;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); color(opts.col ?? C.ink);
    const lines = wrap(s, CW - (opts.indent ?? 0), size);
    const lh = size * 0.46;
    for (const l of lines) { need(lh + 1); doc.setFontSize(size); doc.text(l, M + (opts.indent ?? 0), y); y += lh; }
    y += opts.gap ?? 1.8;
  }
  function bullets(items: string[], col: RGB = C.ink) {
    for (const it of items) {
      doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
      const lines = wrap(it, CW - 6, 9.5);
      need(lines.length * 4.4 + 1);
      fill(C.gold); doc.circle(M + 1.5, y - 1.2, 0.6, 'F');
      color(col);
      for (const l of lines) { doc.text(l, M + 5, y); y += 4.4; }
      y += 0.8;
    }
  }
  function kv(rows: [string, string][], labelW = 62) {
    for (const [k, val] of rows) {
      const lines = wrap(val || '-', CW - labelW - 2, 9.5);
      const h = Math.max(1, lines.length) * 4.4 + 1.6;
      need(h);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color(C.muted); doc.text(T(k), M, y);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); color(C.ink);
      lines.forEach((l, i) => doc.text(l, M + labelW, y + i * 4.4));
      y += h; stroke(C.line); doc.setLineWidth(0.1); doc.line(M, y - 3.2, W - M, y - 3.2);
    }
    y += 1.5;
  }
  function table(head: string[], widths: number[], rows: string[][], size = 8.2) {
    const tot = widths.reduce((a, b) => a + b, 0);
    const sc = CW / tot;
    const ws = widths.map((w) => w * sc);
    const drawHead = () => {
      need(8);
      fill(C.navy); doc.rect(M, y - 4, CW, 6.2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size); color([255, 255, 255]);
      let x = M + 1.5; head.forEach((h, i) => { doc.text(T(h), x, y); x += ws[i]; });
      y += 5;
    };
    drawHead();
    rows.forEach((r, ri) => {
      const cells = r.map((c, i) => wrap(c, ws[i] - 2.5, size));
      const lh = size * 0.45;
      const h = Math.max(...cells.map((c) => c.length)) * lh + 2.2;
      if (y + h > H - 20) { newPage(); drawHead(); }
      if (ri % 2 === 0) { fill(C.soft); doc.rect(M, y - 3.6, CW, h, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size); color(C.ink);
      let x = M + 1.5;
      cells.forEach((c, i) => { c.forEach((l, li) => doc.text(l, x, y + li * lh)); x += ws[i]; });
      y += h;
    });
    y += 2;
  }
  function callout(title: string, text: string, col: RGB) {
    const lines = wrap(text, CW - 8, 9);
    const h = lines.length * 4.1 + 11;
    need(h + 2);
    fill([col[0], col[1], col[2]]); doc.setGState(doc.GState({ opacity: 0.1 })); doc.roundedRect(M, y - 4, CW, h, 1.5, 1.5, 'F'); doc.setGState(doc.GState({ opacity: 1 }));
    fill(col); doc.rect(M, y - 4, 1.4, h, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color(col); doc.text(T(title), M + 5, y + 0.8);
    doc.setFont('helvetica', 'normal'); color(C.ink);
    lines.forEach((l, i) => doc.text(l, M + 5, y + 6 + i * 4.1));
    y += h + 1;
  }

  /* ---------- cover band ---------- */
  fill(C.navy); doc.rect(0, 0, W, 58, 'F');
  fill(C.gold); doc.rect(0, 58, W, 1.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); color([232, 189, 117]); doc.text('ESTATEIQ', M, 16);
  doc.setFontSize(19); color([255, 255, 255]); doc.text('PROPERTY INTELLIGENCE REPORT', M, 28);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); color([200, 210, 225]);
  const tl = wrap(rep.title, CW, 11); tl.slice(0, 2).forEach((l, i) => doc.text(l, M, 37 + i * 5.2));
  doc.setFontSize(8.5); color([150, 165, 190]);
  doc.text(T(`Generated ${fmtDateTime(rep.createdAt)}   |   Report ID ${rep.id}   |   EstateIQ v${rep.appVersion}`), M, 52);
  y = 70;

  if (isDemo) callout('DEMO DATA INCLUDED', 'This report includes illustrative DEMO comparables. They are not real market evidence. The valuation below must not be relied upon.', C.red);
  else if (v.preliminary) callout('PRELIMINARY ANALYSIS', 'Evidence is limited (LOW confidence). Figures are a preliminary decision-support estimate, not a verified market valuation.', C.amber);

  /* ---------- 1 executive summary ---------- */
  h1('1', 'Executive summary');
  const vc = VERDICT_COLOR[rec.verdict];
  need(26);
  fill(vc); doc.roundedRect(M, y - 4, 58, 20, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); color([255, 255, 255]); doc.text('RECOMMENDATION', M + 4, y + 1);
  doc.setFontSize(rec.verdict.length > 12 ? 10.5 : 15); doc.text(T(rec.verdict), M + 4, y + 9);
  doc.setFontSize(7.5); doc.text(T(`${v.confidence} confidence`), M + 4, y + 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); color(C.ink);
  const hl = wrap(rec.headline, CW - 64, 9.5); hl.forEach((l, i) => doc.text(l, M + 63, y + 1 + i * 4.6));
  y += 22;
  kv([
    ['Asking price (excl. registration)', `${fmtRs(v.askingTotal)}  (${fmtWords(v.askingTotal)})`],
    ['Estimated market value', v.estimated ? `${fmtRs(v.fairValue)}  [${v.confidence}${v.preliminary ? ', preliminary' : ''}]` : 'Not estimated - insufficient comparable evidence'],
    ['Premium / discount to estimate', v.estimated ? `${fmtPct(v.differencePct)}  (${fmtRs(v.difference)})` : '-'],
    ['Suggested negotiation price', v.estimated ? fmtRs(v.negotiationPrice) : '-'],
    ['Total acquisition cost (indicative)', fmtRs(cost.totalAcquisition)],
  ]);
  if (rec.unresolved.length) { para('Unresolved risks', { bold: true, col: C.red, gap: 1 }); bullets(rec.unresolved, C.red); }

  /* ---------- 2 property overview / 4 specs ---------- */
  h1('2', 'Property overview');
  const L = inp.location;
  kv([
    ['Property type', TYPE_LABEL[inp.type]],
    ['Location', [L.project, L.locality, L.city, L.state, L.pincode].filter(Boolean).join(', ') || L.displayName],
    ['Purpose', inp.purpose === 'self_use' ? 'Self-use' : inp.purpose === 'investment' ? 'Investment' : 'Rental'],
    ['Sale type', ({ resale: 'Resale', new: 'New / developer', under_construction: 'Under construction', unknown: 'Not stated' })[inp.saleKind]],
    ['Possession', ({ ready: 'Ready', within_6m: 'Within 6 months', later: 'Later', unknown: 'Not stated' })[inp.possession]],
    ['Seller negotiability', ({ firm: 'Firm', some: 'Some room', high: 'High room', unknown: 'Not stated' })[inp.negotiability]],
    ['Buyer budget', inp.budget ? fmtRs(inp.budget) : 'Not provided'],
  ]);

  h1('3', 'Exact location and map');
  kv([
    ['Coordinates', L.lat !== null && L.lon !== null ? `${L.lat.toFixed(6)}, ${L.lon.toFixed(6)}` : 'Not set - location intelligence unavailable'],
    ['How the location was set', ({ search: 'Address search (OpenStreetMap Nominatim)', marker: 'Map marker moved by the user', manual: 'Manual coordinates', device: 'Device location (user permission)', none: 'Not set' })[L.source]],
    ['Resolved address', L.displayName || '-'],
    ['OpenStreetMap link', L.lat !== null ? `openstreetmap.org/?mlat=${L.lat.toFixed(5)}&mlon=${L.lon!.toFixed(5)}#map=16/${L.lat.toFixed(5)}/${L.lon!.toFixed(5)}` : '-'],
  ]);
  drawRadial();

  function drawRadial() {
    if (L.lat === null || L.lon === null || !rep.intel || !rep.intel.places.length) { para('Radial plot omitted: no mapped-amenity data was retrieved.', { col: C.muted }); return; }
    const R = 36, cx = M + 42, size = R * 2 + 12;
    need(size + 6);
    const cy = y + R + 2;
    stroke(C.line); doc.setLineWidth(0.25);
    const ringsKm = [0.5, 1, 2];
    ringsKm.forEach((km) => { doc.circle(cx, cy, (km / 2) * R, 'S'); doc.setFontSize(6.5); color(C.muted); doc.text(`${km} km`, cx + (km / 2) * R + 0.8, cy - 0.8); });
    doc.line(cx - R, cy, cx + R, cy); doc.line(cx, cy - R, cx, cy + R);
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); color(C.muted); doc.text('N', cx - 1, cy - R - 1.2);
    for (const p of rep.intel.places) {
      if (p.distanceKm > 2) continue;
      const b = (bearingDeg(L.lat, L.lon, p.lat, p.lon) * Math.PI) / 180;
      const r = (p.distanceKm / 2) * R;
      const hex = CATEGORY_META[p.category].color;
      doc.setFillColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
      doc.circle(cx + Math.sin(b) * r, cy - Math.cos(b) * r, 0.8, 'F');
    }
    fill(C.navy); doc.circle(cx, cy, 1.6, 'F');
    // legend
    let ly = y + 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    CATEGORY_ORDER.forEach((c) => {
      const hex = CATEGORY_META[c].color;
      doc.setFillColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
      doc.circle(M + 100, ly - 1, 1.1, 'F'); color(C.ink); doc.text(T(CATEGORY_META[c].label), M + 103.5, ly); ly += 5.4;
    });
    doc.setFontSize(7); color(C.muted);
    doc.text('Radial plot of mapped features within 2 km (north up). Not a street map; OSM data may be incomplete.', M, cy + R + 6);
    y = Math.max(cy + R + 9, ly + 2);
  }

  h1('4', 'Property specifications');
  const spec: [string, string][] = [['Pricing area', `${fmtNum(v.area)} sqft (${inp.pricingAreaBasis})`]];
  const add = (k: string, val: string | number | null | boolean, suffix = '') => { if (val !== null && val !== '' && val !== false && val !== undefined) spec.push([k, typeof val === 'boolean' ? 'Yes' : `${typeof val === 'number' ? fmtNum(val) : val}${suffix}`]); };
  if (inp.type === 'plot') {
    add('Dimensions', inp.plotLength && inp.plotWidth ? `${inp.plotLength} x ${inp.plotWidth} ft` : ''); add('Plot number', inp.plotNumber);
    add('Corner plot', inp.corner); add('Road width', inp.roadWidthFt, ' ft'); add('Road type', inp.roadType !== 'unknown' ? inp.roadType : '');
    add('Township / gated', inp.township); add('Approved layout', inp.approvedLayout);
  }
  if (inp.type === 'apartment') { add('Carpet area', inp.carpetArea, ' sqft'); add('Built-up area', inp.builtUpArea, ' sqft'); add('Super built-up area', inp.superBuiltUpArea, ' sqft'); add('Floor', inp.floor !== null && inp.totalFloors !== null ? `${inp.floor} of ${inp.totalFloors}` : inp.floor); add('Bedrooms', inp.bedrooms); add('Parking', inp.parking); add('Lift', inp.lift); add('Amenities', inp.amenities); add('Maintenance', inp.maintenanceMonthly, ' Rs/month'); }
  if (inp.type === 'house') { add('Land area', inp.landArea, ' sqft'); add('Built-up area', inp.builtUpArea, ' sqft'); add('Floors', inp.houseFloors); add('Construction quality', inp.constructionQuality !== 'unknown' ? inp.constructionQuality : ''); add('Bedrooms', inp.bedrooms); add('Parking', inp.parking); }
  if (inp.type === 'commercial') { add('Built-up area', inp.builtUpArea, ' sqft'); add('Floor', inp.floor); add('Road frontage', inp.frontageFt, ' ft'); add('Usage', inp.usage); add('Parking', inp.parking); add('Expected rent', inp.rentalMonthly, ' Rs/month'); }
  add('Age', inp.ageYears, ' years'); add('Facing', inp.facing !== 'unknown' ? DIR_LABEL[inp.facing] : '');
  kv(spec);
  if (inp.attachments.length) { para('Attachments recorded (names only; NOT machine-analysed or legally verified):', { bold: true, gap: 1 }); bullets(inp.attachments.map((a) => `${a.name} (${a.category.replace('_', ' ')})`)); }

  /* ---------- 5 asking price ---------- */
  h1('5', 'Asking price calculation');
  const ask = resolveAsking(inp.pricingArea, inp.askingRate, inp.askingTotal);
  kv([
    ['Area x asking rate', `${fmtNum(ask.area)} sqft x ${fmtRs(ask.rate)}/sqft`],
    ['Base asking price', `${fmtRs(ask.total)}  (${fmtWords(ask.total)})`],
    ['Excludes', 'Stamp duty, registration, brokerage, legal and all other charges (see section 10)'],
  ]);

  /* ---------- 6-9 valuation ---------- */
  h1('6', 'Market price analysis');
  if (!v.estimated) callout('NO MARKET ESTIMATE', v.confidenceReasons.join(' ') + ' EstateIQ does not invent comparables to force a number.', C.amber);
  else {
    kv([
      ['Fair price per sqft', fmtRs(v.fairRate)], ['Low - high rate (weighted 25th-75th pct)', `${fmtRs(v.lowRate)} - ${fmtRs(v.highRate)} /sqft`],
      ['Asking rate vs fair rate', `${fmtRs(v.askingRate)} vs ${fmtRs(v.fairRate)}`], ['Comparables used / excluded', `${v.used.length} / ${v.excluded.length}`],
      ['Evidence mix', `${v.evidenceSummary.transactions} transaction, ${v.evidenceSummary.asking} asking-price, ${v.evidenceSummary.verified} user-verified`],
    ]);
  }
  if (v.guidelineRate) kv([['Government guideline rate (user-entered)', `${fmtRs(v.guidelineRate)}/sqft -> ${fmtRs(v.guidelineValue)}  [reference floor, not a market value]`]]);
  v.notes.forEach((n) => para(n, { col: C.muted, size: 8.5 }));

  h1('7', 'Comparable property evidence');
  if (!v.used.length && !v.excluded.length) para('No comparable evidence was supplied or retrieved.', { col: C.muted });
  if (v.used.length) {
    table(['Label', 'Type', 'Rate/sqft', 'Adj. rate', 'Dist km', 'Age d', 'Weight', 'Source / date'], [18, 17, 13, 13, 9, 8, 9, 33],
      v.used.map((u) => [u.comp.label, u.comp.kind, fmtNum(u.comp.ratePerSqft), fmtNum(u.adjustedRate), u.comp.distanceKm === undefined ? 'n/a' : u.comp.distanceKm.toFixed(1), String(u.ageDays), u.weight.toFixed(2), `${u.comp.sourceName}, ${fmtDate(u.comp.observedOn)}`]));
  }
  if (v.excluded.length) { para('Excluded evidence', { bold: true, gap: 1 }); table(['Label', 'Reason'], [25, 75], v.excluded.map((e) => [e.comp.label, e.reason])); }

  h1('8', 'Fair market valuation');
  if (v.estimated) {
    kv([['Low estimate', fmtRs(v.lowValue)], ['Estimated market value', fmtRs(v.fairValue)], ['High estimate', fmtRs(v.highValue)], ['Asking price', fmtRs(v.askingTotal)], ['Difference (asking - estimate)', `${fmtRs(v.difference)}  (${fmtPct(v.differencePct)})`]]);
    // range bar
    need(18);
    const lo = Math.min(v.lowValue!, v.askingTotal) * 0.97, hi = Math.max(v.highValue!, v.askingTotal) * 1.03;
    const x = (n: number) => M + 6 + ((n - lo) / (hi - lo)) * (CW - 12);
    fill(C.soft); doc.rect(M + 6, y, CW - 12, 5, 'F');
    fill([115, 215, 208]); doc.rect(x(v.lowValue!), y, x(v.highValue!) - x(v.lowValue!), 5, 'F');
    fill(C.navy); doc.rect(x(v.fairValue!) - 0.4, y - 1, 0.8, 7, 'F');
    fill(C.red); doc.triangle(x(v.askingTotal) - 1.5, y - 3, x(v.askingTotal) + 1.5, y - 3, x(v.askingTotal), y, 'F');
    doc.setFontSize(7); color(C.muted); doc.text('Teal = estimated range, dark line = fair value, red marker = asking price', M + 6, y + 10);
    y += 14;
  } else para('Not available (see section 6).', { col: C.muted });

  h1('9', 'Negotiation recommendation');
  if (v.estimated) kv([['Suggested negotiation price', `${fmtRs(v.negotiationPrice)}  (${fmtRs(v.negotiationPrice! / Math.max(1, v.area))}/sqft)`], ['Suggested maximum purchase price', fmtRs(v.maxPurchasePrice)], ['Seller negotiability', ({ firm: 'Firm', some: 'Some room', high: 'High room', unknown: 'Not stated' })[inp.negotiability]]]);
  else para('A negotiation target cannot be derived without a market estimate. Collect comparables first.', { col: C.muted });

  h1('10', 'Total purchase cost');
  para('A. Property price (excluding registration)', { bold: true, gap: 1 });
  kv([['Base price', fmtRs(cost.basePrice)]]);
  para('B. Estimated additional expenses', { bold: true, gap: 1 });
  table(['Item', 'Amount', 'Note'], [38, 20, 42], [...cost.duties, ...cost.additional].map((l) => [l.label, fmtRs(l.amount), l.note ?? '']));
  kv([['Subtotal B', fmtRs(cost.additionalTotal)]]);
  para('C. Total acquisition cost', { bold: true, gap: 1 });
  kv([['A + B', fmtRs(cost.totalAcquisition)]]);
  para(`Duty/registration basis: ${fmtRs(cost.dutyBase)}. Rates as of ${cost.ratesAsOf || 'n/a'} - ${cost.indicative ? 'INDICATIVE, not verified against the official notification' : 'verified by the user'}. Source: ${cost.ratesSource}`, { size: 8.5, col: C.muted });
  cost.warnings.forEach((w) => para('Note: ' + w, { size: 8.5, col: C.amber }));

  /* ---------- 11 location ---------- */
  h1('11', 'Location intelligence');
  if (!rep.intel || !rep.intel.attempted) para('Nearby-amenity data was not retrieved. No amenities, distances or connectivity are asserted.', { col: C.muted });
  else {
    const g = byCategory(rep.intel);
    const rows = CATEGORY_ORDER.map((c) => [CATEGORY_META[c].label, String(g[c].length), g[c][0] ? `${g[c][0].name} (${g[c][0].distanceKm.toFixed(1)} km)` : 'none mapped', CATEGORY_META[c].radiusNote]);
    table(['Category', 'Count', 'Nearest mapped feature', 'Scope'], [26, 9, 40, 25], rows);
    const ls = locationScore(rep.intel);
    para(ls.score === null ? 'Location score not computed (data incomplete).' : `Mapped location score: ${ls.score}/100 (heuristic from nearest distances).`, { bold: true });
    if (rep.intel.errors.length) para('Data gaps: ' + rep.intel.errors.join(' | '), { size: 8.5, col: C.amber });
    para('Flood risk and other geographical hazards were NOT assessed: no reliable open dataset is integrated. Water bodies above are a proximity indicator only. Consult state disaster-management flood maps and the local authority.', { size: 8.5, col: C.muted });
    para(`Source: ${rep.intel.source}, retrieved ${fmtDateTime(rep.intel.fetchedAt)}. Community-edited data; absence of a feature does not prove it does not exist.`, { size: 8.5, col: C.muted });
  }

  /* ---------- 12 vastu ---------- */
  h1('12', 'Vastu assessment (traditional belief)');
  para(rep.vastu.score === null ? `Compatibility score: not computed (${rep.vastu.label})` : `Vastu compatibility score: ${rep.vastu.score}/100 - ${rep.vastu.label}`, { bold: true });
  table(['Factor', 'Score', 'Weight'], [50, 20, 20], rep.vastu.breakdown.map((b) => [b.name, b.score === null ? 'not provided' : String(Math.round(b.score)), `${Math.round(b.weight * 100)}%`]));
  para('Positive aspects', { bold: true, gap: 1 }); bullets(rep.vastu.findings.filter((f) => f.tone === 'positive').map((f) => f.text).concat(rep.vastu.findings.some((f) => f.tone === 'positive') ? [] : ['None identified from the inputs provided.']));
  para('Potential concerns and notes', { bold: true, gap: 1 }); bullets(rep.vastu.findings.filter((f) => f.tone !== 'positive').map((f) => f.text));
  para('Suggested improvements', { bold: true, gap: 1 }); bullets(rep.vastu.improvements);
  para('Principles applied', { bold: true, gap: 1 }); bullets(rep.vastu.principles);
  callout('VASTU DISCLAIMER', rep.vastu.disclaimer, C.muted);

  /* ---------- 13 legal ---------- */
  h1('13', 'Legal due-diligence checklist');
  para(STATUS_HELP, { size: 8.5, col: C.muted });
  const uploaded = new Set(inp.attachments.map((a) => ATTACHMENT_TO_ITEM[a.category]).filter(Boolean));
  table(['Check', 'Critical', 'Status', 'How to verify'], [34, 10, 24, 44],
    itemsFor(inp.type).map((i) => { const s = legalStatusOf(inp, i.id); return [i.title, i.critical ? 'Yes' : 'No', STATUS_LABEL[s] + (s === 'not_started' && uploaded.has(i.id) ? ' (file attached, unverified)' : ''), i.howToVerify]; }), 7.8);
  para('Official portals are not integrated. Start manual checks at the MP IGR / SAMPADA portal (mpigr.gov.in), the state land-records service and the MP RERA website; availability and access rules vary.', { size: 8.5, col: C.muted });

  /* ---------- 14-16 ---------- */
  h1('14', 'Risk analysis');
  if (!rec.risks.length) para('No specific risks were triggered by the inputs. This is not an all-clear: missing inputs are not evidence of safety.', { col: C.muted });
  else table(['Severity', 'Risk', 'Detail'], [14, 30, 56], rec.risks.map((r) => [r.severity.toUpperCase(), r.title, r.detail]));

  h1('15', 'Investment suitability');
  para(rec.investment.suitability, { bold: true }); bullets(rec.investment.points);
  table(['Dimension', 'Score', 'Basis'], [34, 14, 42], rec.scores.map((s) => [s.label, s.value === null ? 'n/a' : `${s.value}/100`, s.note]));

  h1('16', 'Final recommendation');
  need(20);
  fill(VERDICT_COLOR[rec.verdict]); doc.roundedRect(M, y - 4, CW, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); color([255, 255, 255]); doc.text(T(rec.verdict), M + 5, y + 5.5); y += 16;
  para(rec.headline, { bold: true }); bullets(rec.reasons);
  if (rec.unresolved.length) { para('Unresolved risks', { bold: true, col: C.red, gap: 1 }); bullets(rec.unresolved, C.red); }

  /* ---------- 17-19 ---------- */
  h1('17', 'Data sources and timestamps');
  table(['Source', 'Status', 'Retrieved', 'Detail'], [30, 14, 18, 38], rep.sources.map((s) => [s.name + (s.url ? ` (${s.url})` : ''), s.status.replace('_', ' '), fmtDateTime(s.retrievedAt), s.detail]), 7.6);
  if (rep.marketFetchError) para('Market-data endpoint error: ' + rep.marketFetchError, { size: 8.5, col: C.amber });

  h1('18', 'Confidence score and methodology');
  kv([['Valuation confidence', v.confidence + (v.preliminary ? ' (preliminary)' : '')]]);
  bullets(v.confidenceReasons);
  para('Method: comparables of the SAME property type are screened for validity, age and distance; outliers are removed only with 5+ comparables; each remaining comparable is weighted by recency (270-day half-life) x distance (1/(1+km)) x evidence type (transaction 1.0, asking 0.6) x size similarity, and optionally adjusted for road width, corner and township where the comparable states the attribute (editable assumptions, not market-calibrated). Fair rate = weighted mean; range = weighted 25th-75th percentile (+/-15% placeholder if fewer than 3 comparables). Confidence: HIGH needs 5+ comparables, median age <= 180 days, dispersion <= 20% and at least one transaction; MEDIUM needs 3+, <= 365 days, <= 35%; otherwise LOW. Asking prices are never treated as registered transaction prices, and guideline values are shown only as a reference floor.', { size: 8.5 });
  para(`Assumptions used: asking-price haircut ${rep.assumptions.askingDiscountPct}%, max evidence age ${rep.assumptions.maxCompAgeDays} days, max distance ${rep.assumptions.maxCompDistanceKm} km, road adj ${rep.assumptions.roadAdjPctPer10ft}%/10 ft, corner ${rep.assumptions.cornerAdjPct}%, township ${rep.assumptions.townshipAdjPct}%.`, { size: 8.5, col: C.muted });

  h1('19', 'Disclaimer');
  para('EstateIQ is a decision-support tool. This report is not a bank valuation, a government valuation, legal advice, a title opinion, a structural survey or financial advice. Calculated results are not verified market valuations. Asking prices are offers, not completed sales. Third-party data (OpenStreetMap and any user-supplied or endpoint-supplied comparables) may be incomplete, outdated or wrong. Stamp duty and registration figures are indicative unless marked verified. Vastu content reflects a traditional belief system and has no scientific validation. Engage a qualified local property lawyer and, where relevant, a registered valuer before paying any token or advance.', { size: 8.8 });

  /* ---------- footer on every page ---------- */
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    stroke(C.line); doc.setLineWidth(0.2); doc.line(M, H - 13, W - M, H - 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); color(C.muted);
    doc.text(T(`EstateIQ - Property Intelligence Report  |  ${isDemo ? 'CONTAINS DEMO DATA  |  ' : ''}${v.preliminary ? 'PRELIMINARY  |  ' : ''}Not a valuation certificate`), M, H - 8.5);
    doc.text(`Page ${i} of ${n}`, W - M, H - 8.5, { align: 'right' });
  }
  return doc;
}

export function pdfBlob(rep: AnalysisReport): Blob { return buildPdf(rep).output('blob'); }

export function downloadPdf(rep: AnalysisReport): void {
  const safe = pdfSafe(rep.title).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'report';
  buildPdf(rep).save(`EstateIQ_${safe}.pdf`);
}

export function printPdf(rep: AnalysisReport): void {
  const url = URL.createObjectURL(pdfBlob(rep));
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  f.src = url;
  f.onload = () => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch { window.open(url, '_blank'); } setTimeout(() => { URL.revokeObjectURL(url); f.remove(); }, 60000); };
  document.body.appendChild(f);
}
