import nextEnv from '@next/env';
import { mkdir, writeFile } from 'node:fs/promises';

nextEnv.loadEnvConfig(process.cwd());
const key = process.env.KAKAO_REST_API_KEY;
if (!key) throw new Error('Kakao REST key missing');
const addresses = ['서울 영등포구 양평로 12', '서울 영등포구 양평로12길 9', '서울 영등포구 당산로41길 11', '서울 영등포구 버드나루로23길 25'];
const output = 'data/office-research-2026-10-06';
await mkdir(output, { recursive: true });
async function request(endpoint, params) {
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/${endpoint}.json?${new URLSearchParams(params)}`, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Kakao HTTP ${response.status}`);
  return response.json();
}
function exclusion(place) {
  if (/카페|디저트|제과|베이커리|간식|아이스크림|도넛|떡,한과/.test(place.category_name)) return '카페·디저트';
  if (/술집|주점|호프|바\b|이자카야|와인바/.test(place.category_name)) return '술집';
  return null;
}
const spots = [];
const unique = new Map();
for (const [i, address] of addresses.entries()) {
  const geo = await request('address', { query: address });
  if (geo.documents.length !== 1) throw new Error(`Spot ${i + 1}: ambiguous address (${geo.documents.length})`);
  const center = geo.documents[0];
  const all = [];
  for (let page = 1; page <= 3; page++) {
    const result = await request('category', { category_group_code: 'FD6', x: center.x, y: center.y, radius: '1000', sort: 'distance', page: String(page), size: '15' });
    all.push(...result.documents);
    if (result.meta.is_end) break;
  }
  const rejected = all.filter(p => exclusion(p)).map(p => ({ ...p, reason: exclusion(p) }));
  const selected = all.filter(p => !exclusion(p)).slice(0, 30);
  const spot = { spot: i + 1, query: address, resolvedAddress: center.road_address?.address_name || center.address_name, lat: Number(center.y), lng: Number(center.x), radius: 1000, rawCount: all.length, selectedCount: selected.length, selectedIds: selected.map(p => p.id), rejected };
  spots.push(spot);
  await writeFile(`${output}/spot-${i + 1}-raw.json`, JSON.stringify({ spot, places: all }, null, 2));
  for (const p of selected) {
    if (!unique.has(p.id)) unique.set(p.id, { id: p.id, name: p.place_name, category: p.category_name, address: p.road_address_name || p.address_name, phone: p.phone, lat: Number(p.y), lng: Number(p.x), url: `https://place.map.kakao.com/${p.id}`, spots: [], review: { status: 'pending', closedDays: [], hours: null, lunch: 'unverified' } });
    unique.get(p.id).spots.push({ spot: i + 1, distance: Number(p.distance) });
  }
}
const data = { collectedAt: new Date().toISOString(), radius: 1000, perSpotLimit: 30, spots, places: [...unique.values()] };
await writeFile(`${output}/candidates.json`, JSON.stringify(data, null, 2));
console.log(JSON.stringify({ spots: spots.map(s => ({ spot: s.spot, address: s.resolvedAddress, raw: s.rawCount, excluded: s.rejected.length, selected: s.selectedCount })), unique: unique.size, output }, null, 2));
