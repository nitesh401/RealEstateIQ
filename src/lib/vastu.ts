import type { Direction, PropertyInput, VastuFinding, VastuResult } from './types';
import { DIR_LABEL } from './format';

/**
 * Traditional-Vastu rule tables. These encode commonly cited textbook interpretations; schools differ.
 * Scores are 0-100 "conformity with the traditional guideline", NOT a measure of property quality or value.
 */
const FACING: Record<Exclude<Direction, 'unknown'>, number> = { NE: 95, E: 88, N: 85, NW: 62, W: 60, SE: 55, S: 50, SW: 35 };
const ENTRANCE: Record<Exclude<Direction, 'unknown'>, number> = { NE: 95, N: 88, E: 88, NW: 62, W: 58, SE: 52, S: 50, SW: 30 };
const ROAD: Record<Exclude<Direction, 'unknown'>, number> = { NE: 90, N: 85, E: 85, NW: 62, W: 60, SE: 58, S: 55, SW: 40 };
const SHAPE: Record<Exclude<PropertyInput['plotShape'], 'unknown'>, number> = { square: 100, rectangle: 90, irregular: 50, l_shaped: 40, triangular: 25 };

const GOOD_ZONES = {
  kitchen: { good: ['SE', 'NW'], bad: ['NE', 'SW'] },
  masterBedroom: { good: ['SW', 'S', 'W'], bad: ['NE', 'SE'] },
  pooja: { good: ['NE', 'E', 'N'], bad: ['S', 'SW', 'SE'] },
  toilet: { good: ['NW', 'W', 'S'], bad: ['NE', 'E', 'SW'] },
} as const;

const ZONE_LABEL = { kitchen: 'Kitchen', masterBedroom: 'Master bedroom', pooja: 'Pooja / prayer room', toilet: 'Toilet' } as const;

export const VASTU_DISCLAIMER =
  'Vastu Shastra is a traditional belief system. It is not scientifically validated as a measure of property quality, health, prosperity or financial outcome, and interpretations differ between practitioners. This assessment applies commonly cited textbook rules only and does not replace an architect or a Vastu consultant. It must not influence legal or financial due diligence.';

const known = (d: Direction): d is Exclude<Direction, 'unknown'> => d !== 'unknown';

export function assessVastu(p: PropertyInput): VastuResult {
  const findings: VastuFinding[] = [];
  const improvements: string[] = [];
  const principles: string[] = [
    'Plot facing is the side of the plot that the main road/front boundary faces. It is NOT automatically the same as the entrance or the road direction.',
    'North-East is traditionally associated with the water/prayer zone and North/East with light and openness; South-West with stability and weight; South-East with fire; North-West with air/movement.',
    'Regular, square or rectangular plots are traditionally preferred; cut corners and irregular shapes are viewed as less favourable.',
  ];
  const breakdown: VastuResult['breakdown'] = [];

  // --- facing
  let facingScore: number | null = null;
  if (known(p.facing)) {
    facingScore = FACING[p.facing];
    findings.push({ tone: facingScore >= 80 ? 'positive' : 'concern', text: `${DIR_LABEL[p.facing]}-facing plot: ${facingScore >= 80 ? 'traditionally regarded as favourable' : facingScore >= 60 ? 'traditionally considered conditional – entrance placement and layout matter' : 'traditionally treated with caution – layout and entrance corrections are usually recommended'}.` });
    if (facingScore < 60) improvements.push('Review entrance position and room placement with a qualified architect/Vastu practitioner; many traditional remedies concern layout, not the plot itself.');
  } else findings.push({ tone: 'note', text: 'Plot facing not provided – verify with a compass or survey, then re-run.' });
  breakdown.push({ name: 'Plot facing', score: facingScore, weight: 0.25 });

  // --- entrance
  let entScore: number | null = null;
  if (known(p.entrance)) {
    entScore = ENTRANCE[p.entrance];
    findings.push({ tone: entScore >= 80 ? 'positive' : 'concern', text: `Main entrance in the ${DIR_LABEL[p.entrance]}: ${entScore >= 80 ? 'a favoured entrance direction in traditional texts' : 'a less favoured entrance direction in traditional texts'}.` });
    if (entScore < 60) improvements.push(`Consider whether the main door can be shifted within the ${DIR_LABEL[p.facing] ?? 'front'} wall toward the more favoured portion (traditionally North-East-most or East-most part of the front).`);
  } else findings.push({ tone: 'note', text: 'Main entrance direction not provided.' });
  breakdown.push({ name: 'Main entrance', score: entScore, weight: 0.3 });

  if (known(p.facing) && known(p.entrance) && p.facing !== p.entrance) {
    findings.push({ tone: 'note', text: `Plot facing (${DIR_LABEL[p.facing]}) and entrance (${DIR_LABEL[p.entrance]}) differ. They are assessed separately – facing alone does not decide the entrance.` });
  }

  // --- road direction
  let roadScore: number | null = null;
  if (known(p.roadDirection)) {
    roadScore = ROAD[p.roadDirection];
    findings.push({ tone: roadScore >= 80 ? 'positive' : 'note', text: `Road on the ${DIR_LABEL[p.roadDirection]} side: ${roadScore >= 80 ? 'traditionally considered supportive' : 'neutral to cautionary in many traditional schools'}.` });
    if (known(p.facing) && p.facing !== p.roadDirection) findings.push({ tone: 'note', text: `The road is on the ${DIR_LABEL[p.roadDirection]} side but the plot is recorded as ${DIR_LABEL[p.facing]}-facing. Please re-check: this is normal only for corner or specially oriented plots.` });
  } else findings.push({ tone: 'note', text: 'Road direction not provided.' });
  breakdown.push({ name: 'Road direction', score: roadScore, weight: 0.15 });

  // --- shape
  let shapeScore: number | null = null;
  if (p.plotShape !== 'unknown') {
    shapeScore = SHAPE[p.plotShape];
    let s = shapeScore;
    if (p.plotShape === 'rectangle' && p.plotLength && p.plotWidth) {
      const ratio = Math.max(p.plotLength, p.plotWidth) / Math.min(p.plotLength, p.plotWidth);
      if (ratio > 2) { s = 70; findings.push({ tone: 'concern', text: `Length-to-width ratio ${ratio.toFixed(1)}:1 – traditional texts prefer ratios up to about 1:2.` }); }
    }
    shapeScore = s;
    findings.push({ tone: shapeScore >= 85 ? 'positive' : 'concern', text: `Plot shape (${p.plotShape.replace('_', '-')}): ${shapeScore >= 85 ? 'regular shape is traditionally preferred' : 'irregular shapes are traditionally viewed as less favourable'}.` });
    if (shapeScore < 60) improvements.push('Irregular or cut plots: have a surveyor confirm usable regular area; building layouts can square off the usable footprint.');
  } else findings.push({ tone: 'note', text: 'Plot shape not provided.' });
  breakdown.push({ name: 'Plot shape', score: shapeScore, weight: 0.2 });

  // --- corner
  let cornerScore: number | null = null;
  if (p.corner && known(p.roadDirection) && known(p.facing)) {
    const pair = new Set([p.roadDirection, p.facing]);
    if (pair.has('N') && pair.has('E')) { cornerScore = 95; findings.push({ tone: 'positive', text: 'North and East road sides (North-East corner plot) are traditionally regarded as very favourable.' }); }
    else if (pair.has('S') && pair.has('W')) { cornerScore = 40; findings.push({ tone: 'concern', text: 'South and West road sides (South-West corner plot) are traditionally viewed with caution.' }); improvements.push('South-West corner plots: keep the South-West portion heavier/higher and avoid openings there, per traditional guidance.'); }
    else { cornerScore = 70; findings.push({ tone: 'note', text: 'Corner plot with mixed road sides: traditional views vary by the specific corner.' }); }
  }
  breakdown.push({ name: 'Corner position', score: cornerScore, weight: 0.1 });

  // --- optional floor plan zones
  const zoneMsgs: VastuFinding[] = [];
  const zoneScores: number[] = [];
  (Object.keys(GOOD_ZONES) as (keyof typeof GOOD_ZONES)[]).forEach((k) => {
    const d = p.zones[k];
    if (!known(d)) return;
    const g = GOOD_ZONES[k];
    if ((g.good as readonly string[]).includes(d)) { zoneScores.push(95); zoneMsgs.push({ tone: 'positive', text: `${ZONE_LABEL[k]} in the ${DIR_LABEL[d]}: matches the traditionally preferred zones.` }); }
    else if ((g.bad as readonly string[]).includes(d)) { zoneScores.push(30); zoneMsgs.push({ tone: 'concern', text: `${ZONE_LABEL[k]} in the ${DIR_LABEL[d]}: traditionally discouraged.` }); improvements.push(`${ZONE_LABEL[k]} placement: preferred zones are ${g.good.map((x) => DIR_LABEL[x]).join(' / ')}.`); }
    else { zoneScores.push(65); zoneMsgs.push({ tone: 'note', text: `${ZONE_LABEL[k]} in the ${DIR_LABEL[d]}: neutral in most traditional schools.` }); }
  });
  findings.push(...zoneMsgs);
  const zoneScore = zoneScores.length ? zoneScores.reduce((a, b) => a + b, 0) / zoneScores.length : null;
  breakdown.push({ name: 'Floor-plan zones (entered)', score: zoneScore, weight: 0.15 });
  if (zoneScore === null) findings.push({ tone: 'note', text: 'Room-zone inputs not provided. Uploaded floor plans are not machine-read – enter room zones in the Vastu step to include them.' });

  // weighted score over available factors only
  const avail = breakdown.filter((b) => b.score !== null);
  const wsum = avail.reduce((s, b) => s + b.weight, 0);
  const score = avail.length >= 2 ? Math.round(avail.reduce((s, b) => s + (b.score as number) * b.weight, 0) / wsum) : null;
  const label = score === null ? 'Insufficient inputs' : score >= 78 ? 'Largely consistent with traditional guidance' : score >= 58 ? 'Mixed – some conditional factors' : 'Several traditional concerns';
  if (!improvements.length) improvements.push('No specific layout corrections are indicated by the inputs provided. A site visit by an architect can refine this.');
  if (p.northReference === 'unknown') findings.push({ tone: 'note', text: 'North reference is unknown – directions may be mis-recorded. Confirm with a compass (note magnetic declination) or the map.' });

  return { score, label, findings, improvements, principles, breakdown, disclaimer: VASTU_DISCLAIMER };
}
