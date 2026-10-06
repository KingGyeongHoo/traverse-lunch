import { readFile, writeFile } from 'node:fs/promises';
const root = 'data/office-research-2026-10-06';
const candidates = JSON.parse(await readFile(`${root}/candidates.json`, 'utf8'));
const reviews = JSON.parse(await readFile(`${root}/reviews.json`, 'utf8'));
const weekdays = '일월화수목금토';
const duplicates = { '711068121': '295390465', '242846042': '848645187' };
const deferred = { '1907103157': '식당 운영정보 미확인: 같은 주소의 일떼라쪼와 관계 불명', '164189894': '요일별 점심 영업이 다름; 배달 제공 시간만 확인되어 매장 확인 필요', '894074367': '화요일 15시 개점; 배달 제공 시간만 확인되어 매장 확인 필요' };

function schedule(review) {
  const weekly = {};
  const full = review.fullHours || '';
  const source = full.includes('기본 영업시간') ? full.split('공휴일')[0].split('휴무일')[0] : review.hours;
  let days = [];
  for (const line of source.split('\n')) {
    const match = line.match(/^([일월화수목금토])(?:\(\d+\/\d+\))?$/);
    if (match) { days = [weekdays.indexOf(match[1])]; weekly[days[0]] = []; }
    else if (line === '매일') { days = [0,1,2,3,4,5,6]; for (const day of days) weekly[day] = []; }
    else if (/^\d\d:\d\d ~ \d\d:\d\d/.test(line) || line === '휴무일') for (const day of days) weekly[day].push(line);
  }
  const regular = [...full.matchAll(/(?:매주\s*)?([일월화수목금토])요일/g)].map(m => weekdays.indexOf(m[1]));
  if (regular.length) for (const day of regular) weekly[day] = ['휴무일'];
  const closedDays = Object.entries(weekly).filter(([,lines])=>lines.includes('휴무일')).map(([day])=>Number(day)).sort();
  const times = day => (weekly[day] || []).find(line => /^\d\d:\d\d ~ \d\d:\d\d$/.test(line));
  const start = line => Number(line.slice(0,2)) * 60 + Number(line.slice(3,5));
  const openWeekdays = [1,2,3,4,5].filter(day => times(day));
  const lunchDays = openWeekdays.filter(day => start(times(day)) < 14*60);
  const groups = new Map();
  for (const day of [1,2,3,4,5,6,0]) {
    if (!times(day)) continue;
    const breaks = weekly[day].filter(line=>line.includes('브레이크타임')).map(line=>line.replace(' 브레이크타임','').replaceAll(' ', '')).join('/');
    const text = times(day).replaceAll(' ', '') + (breaks ? ` (휴게 ${breaks})` : '');
    const group = groups.get(text)||[];group.push(day);groups.set(text,group);
  }
  const summary = [...groups].map(([time,days])=>`${days.length===7?'매일':days.map(d=>weekdays[d]).join('·')} ${time}`).join('; ');
  return { weekly, closedDays, summary, known:openWeekdays.length>0, noWeekdayLunch:openWeekdays.length>0 && lunchDays.length===0, partialWeekdayLunch: lunchDays.length>0 && lunchDays.length<openWeekdays.length, holidayInfo:full.split('휴무일\n')[1]?.split('\n')[0] || null, closureSource: full ? '상세 영업정보' : '2026-10-06~12 요일표' };
}
function category(p) { return ['한식','중식','일식','양식','분식'].find(c=>p.category.includes(c)) || (/탄탄면/.test(p.name)?'중식':'기타'); }
const results = candidates.places.map(place => {
  const review = reviews.find(r=>r.id===place.id);
  if (!review || review.error || !review.hours) throw new Error(`Review incomplete: ${place.name}`);
  const s = schedule(review);
  let status = 'ready', reason = '';
  if (duplicates[place.id]) { status='duplicate'; reason=`동일 주소·상호로 통합: ${duplicates[place.id]}`; }
  else if (deferred[place.id]) { status='deferred'; reason=deferred[place.id]; }
  else if (/임시 휴업|폐업/.test(review.hours)) { status='excluded'; reason='임시 휴업 또는 폐업 표시'; }
  else if (/호프|주점|와인바|이자카야/.test(place.name)) { status='excluded'; reason='술집'; }
  else if (s.noWeekdayLunch) { status='excluded'; reason='평일 점심 영업 없음(14시 이후 개점)'; }
  const closed = s.closedDays.length ? s.closedDays.map(d=>weekdays[d]).join('·')+' 휴무' : s.known ? '정기휴무 미표기' : '휴무 미확인';
  const delivery = review.hours.includes('요기요 제공') ? '배달 기준·매장 확인 필요' : '';
  const lunch = !s.known ? '점심 영업 미확인' : s.partialWeekdayLunch ? '요일별 점심 시간 확인' : '';
  const exceptional = s.holidayInfo && /설|추석|공휴일|성탄절|1월1일/.test(s.holidayInfo) ? '공휴일·명절 휴무 별도 확인' : '';
  const warnings = [closed,lunch,delivery,exceptional].filter(Boolean).join(' / ');
  const base = `${place.url}\n${place.address}\n${warnings}\n확인 2026-10-06`;
  let note = `${place.url}\n${place.address}\n${s.summary}\n${warnings}\n확인 2026-10-06`;
  if (note.length>200) note=base+`\n영업시간은 상세 링크 확인`;
  if (note.length>200) throw new Error(`Note too long: ${place.name}`);
  return {...place, review:{...review,...s},status,reason,input:{name:place.name,category:category(place),distance:null,note,closedDays:s.closedDays}};
});
const report = {collectedAt:candidates.collectedAt,reviewedAt:new Date().toISOString(),radius:1000,perSpotLimit:30,spots:candidates.spots.map(s=>({spot:s.spot,address:s.resolvedAddress,radius:s.radius,raw:s.rawCount,selected:s.selectedCount})),results};
await writeFile(`${root}/reviewed.json`,JSON.stringify(report,null,2));
await writeFile(`${root}/import-plan.json`,JSON.stringify(results.filter(p=>p.status==='ready').map(p=>({placeId:p.id,spots:p.spots,input:p.input})),null,2));
const counts={};for(const p of results)counts[p.status]=(counts[p.status]||0)+1;
console.log(JSON.stringify({counts,unknownHours:results.filter(p=>p.status==='ready'&&!p.review.known).map(p=>p.name),withClosedDays:results.filter(p=>p.status==='ready'&&p.input.closedDays.length).length,exceptions:results.filter(p=>p.status!=='ready').map(p=>({name:p.name,status:p.status,reason:p.reason}))},null,2));
