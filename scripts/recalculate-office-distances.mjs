import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const directory = 'data/office-research-2026-10-06';
const candidates = JSON.parse(await readFile(`${directory}/candidates.json`, 'utf8'));
const snapshot = JSON.parse(await readFile(`${directory}/before-distance.json`, 'utf8'));
const spot = candidates.spots.find(s => s.resolvedAddress === '서울 영등포구 양평로 12');
assert.ok(spot, 'Office address must resolve to the collected coordinate');
const origin = { address: spot.resolvedAddress, lat: spot.lat, lng: spot.lng };
const radians = value => value * Math.PI / 180;
function distanceMeters(a, b) {
  for (const p of [a,b]) assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat)<=90 && Math.abs(p.lng)<=180);
  const h = Math.sin(radians(b.lat-a.lat)/2)**2 + Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lng-a.lng)/2)**2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
assert.equal(distanceMeters(origin,origin),0);
assert.ok(Math.abs(distanceMeters({lat:0,lng:0},{lat:0,lng:1})-111195.08)<1);
const classify = meters => meters<=300 ? '가까움' : meters<=600 ? '중간' : '멂';
assert.equal(classify(300),'가까움');
assert.equal(classify(301),'중간');
assert.equal(classify(600),'중간');
assert.equal(classify(601),'멂');
const rows = snapshot.restaurants.map(restaurant => {
  const placeId = restaurant.note.match(/https:\/\/place\.map\.kakao\.com\/(\d+)/)?.[1];
  const place = candidates.places.find(p => p.id===placeId);
  assert.ok(place, `Missing coordinates for ${restaurant.name}`);
  const exactMeters = distanceMeters(origin, place);
  const meters = Math.round(exactMeters);
  const providerDistance = place.spots.find(s=>s.spot===spot.spot)?.distance;
  if (providerDistance!==undefined) assert.ok(Math.abs(meters-providerDistance)<=2, `Coordinate result differs from Kakao reference: ${restaurant.name}`);
  const distance = classify(meters);
  const originalNote = restaurant.note.replace(/^양평로12 직선 약 \d+m\n/, '');
  const note = `양평로12 직선 약 ${meters}m\n${originalNote}`;
  assert.ok(note.length<=200, `Note exceeds 200 characters: ${restaurant.name}`);
  return { id:restaurant.id, placeId, name:restaurant.name, latitude:place.lat, longitude:place.lng, exactMeters, meters, distance, before:restaurant, input:{name:restaurant.name,category:restaurant.category,distance,note,closedDays:restaurant.closedDays} };
});
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
const report = { measuredAt:new Date().toISOString(),origin,method:'Haversine, mean Earth radius 6371008.8m; straight-line distance',thresholds:{nearMaxMeters:300,middleMaxMeters:600},rows };
await writeFile(`${directory}/distance-plan.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({address:origin.address,count:rows.length,minimumMeters:Math.min(...rows.map(r=>r.meters)),maximumMeters:Math.max(...rows.map(r=>r.meters)),groups:rows.reduce((out,r)=>(out[r.distance]=(out[r.distance]||0)+1,out),{}),longestNote:Math.max(...rows.map(r=>r.input.note.length))},null,2));
