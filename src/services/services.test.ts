import { afterEach, describe, expect, it, vi } from 'vitest';
import { classify, nearbyQuery, parseElements, type OverpassElement } from './overpass';
import { validateMarketResponse, fetchMarketComparables } from './market';
import { fetchJson, ServiceError } from './http';
import { searchAddress } from './nominatim';

afterEach(() => vi.restoreAllMocks());

describe('overpass parsing', () => {
  it('classifies tags and computes distances; drops unclassified', () => {
    const els: OverpassElement[] = [
      { type: 'node', id: 1, lat: 22.72, lon: 75.86, tags: { amenity: 'school', name: 'A School' } },
      { type: 'way', id: 2, center: { lat: 22.73, lon: 75.87 }, tags: { amenity: 'hospital', name: 'City Hospital' } },
      { type: 'node', id: 3, lat: 22.72, lon: 75.86, tags: { shop: 'bakery', name: 'x' } },
      { type: 'node', id: 4, lat: 22.8, lon: 75.9, tags: { railway: 'station', name: 'Indore Jn' } },
    ];
    const p = parseElements(els, 22.7196, 75.8577);
    expect(p.map((x) => x.category).sort()).toEqual(['hospital', 'railway', 'school']);
    expect(p.every((x) => x.distanceKm >= 0)).toBe(true);
  });
  it('classify handles highways & construction', () => {
    expect(classify({ highway: 'trunk' })).toBe('highway');
    expect(classify({ highway: 'construction', name: 'x' })).toBe('development');
    expect(classify({ highway: 'bus_stop' })).toBe('bus');
  });
  it('builds a query containing the coordinates', () => {
    expect(nearbyQuery(22.7, 75.8, 2000)).toContain('around:2000,22.7,75.8');
  });
});

describe('market endpoint contract', () => {
  it('validates and drops malformed comparables', () => {
    const r = validateMarketResponse({ sourceName: 'S', comparables: [{ id: 'a', propertyType: 'plot', kind: 'asking', ratePerSqft: 4000, observedOn: '2026-10-01' }, { ratePerSqft: -1 }, { propertyType: 'plot', kind: 'bogus', ratePerSqft: 1, observedOn: 'x' }] });
    expect(r.comparables).toHaveLength(1);
    expect(() => validateMarketResponse({})).toThrow(ServiceError);
  });
  it('rejects non-https endpoints', async () => {
    await expect(fetchMarketComparables('http://example.com/x', { lat: 1, lon: 1, type: 'plot', radiusKm: 5 })).rejects.toThrow(/https/);
  });
});

describe('http error mapping (TEST 5/6 resilience)', () => {
  it('maps network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    await expect(fetchJson('https://x.test')).rejects.toMatchObject({ kind: 'network' });
  });
  it('maps 429 to rate_limit', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(fetchJson('https://x.test')).rejects.toMatchObject({ kind: 'rate_limit' });
  });
  it('maps timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => { init.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))); })));
    await expect(fetchJson('https://x.test', {}, 20)).rejects.toMatchObject({ kind: 'timeout' });
  });
  it('invalid address => friendly empty-result error, no crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }));
    await expect(searchAddress('zzzzqqqq nowhere 99999')).rejects.toMatchObject({ kind: 'empty' });
    await expect(searchAddress('ab')).rejects.toMatchObject({ kind: 'empty' });
  });
  it('geocoder result is normalised', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ lat: '22.7', lon: '75.8', display_name: 'Super Corridor, Indore', address: { city: 'Indore', state: 'Madhya Pradesh', postcode: '452001' } }] }));
    const r = await searchAddress('Super Corridor, Indore');
    expect(r[0]).toMatchObject({ lat: 22.7, lon: 75.8, address: { city: 'Indore', pincode: '452001' } });
  });
});

import { runAnalysis } from './runAnalysis';
import { emptyInput } from '../lib/analysis';
import { DEFAULT_ASSUMPTIONS } from '../lib/costs';

describe('runAnalysis graceful degradation (TEST 6)', () => {
  it('still returns a labelled preliminary report when every network call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const input = { ...emptyInput(), pricingArea: 1500, askingRate: 4500 };
    input.location = { ...input.location, lat: 22.7196, lon: 75.8577, source: 'manual' };
    const rep = await runAnalysis(input, { ...DEFAULT_ASSUMPTIONS, marketEndpoint: 'https://market.example.test/api' });
    expect(rep.valuation.askingTotal).toBe(6750000);
    expect(rep.valuation.estimated).toBe(false);
    expect(rep.valuation.preliminary).toBe(true);
    expect(rep.marketFetchError).toMatch(/Network error/);
    expect(rep.intel?.partial).toBe(true);
    expect(rep.recommendation.verdict).toBe('HOLD');
  }, 20000);
  it('merges comparables from a working market endpoint and records its source', async () => {
    const market = { sourceName: 'Test feed', retrievedAt: '2026-11-01T00:00:00Z', comparables: [3900, 4000, 4100].map((r, i) => ({ id: 'm' + i, propertyType: 'plot', kind: 'transaction', ratePerSqft: r, observedOn: new Date().toISOString().slice(0, 10), sourceName: 'Test feed', distanceKm: 1 })) };
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('market.example') ? { ok: true, status: 200, json: async () => market } : { ok: true, status: 200, json: async () => ({ elements: [{ type: 'node', id: 1, lat: 22.72, lon: 75.86, tags: { amenity: 'school', name: 'S' } }] }) })));
    const input = { ...emptyInput(), pricingArea: 1500, askingRate: 4500 };
    input.location = { ...input.location, lat: 22.7196, lon: 75.8577, source: 'manual' };
    const rep = await runAnalysis(input, { ...DEFAULT_ASSUMPTIONS, marketEndpoint: 'https://market.example.test/api' });
    expect(rep.valuation.estimated).toBe(true);
    expect(rep.valuation.used).toHaveLength(3);
    expect(rep.sources.some((s) => s.name === 'Test feed' && s.status === 'used')).toBe(true);
    expect(rep.intel?.places.length).toBeGreaterThan(0);
  });
});
