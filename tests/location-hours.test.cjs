const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const context = {window: {}, document: {readyState: 'loading', addEventListener(){}}, Intl, Date};
const source = fs.readFileSync(path.join(__dirname, '../location-block.js'), 'utf8');
vm.runInNewContext(source.replace("if(document.readyState === 'loading'){",
  'window.test = {buildHours, normalizeConfig, activeHoursPeriod};\n' +
  "if(document.readyState === 'loading'){"), context);
const api = context.window.test;
const now = {date:'2026-09-17', dayKey:'jeudi', nowMinutes:720};
const cfg = api.normalizeConfig({showStatus:true,collapseHours:false}, 0);
test('Unknown structured hours do not claim closure; explicit closure does', () => {
  const html = api.buildHours({openingHours:{weekly:{}}},now,cfg,{});
  assert(html.includes('Non renseigné'));
  assert(!html.includes('is-closed'));
  const closed = api.buildHours({openingHours:{weekly:{jeudi:'Fermé'}}},now,cfg,{});
  assert(closed.includes('Fermé'));
  assert(closed.includes('is-closed'));
});
test('Dated period uses exact dates, displays unknown days and ends cleanly', () => {
  const settings = {...cfg,hoursPeriod:{startsOn:'2026-09-16',endsOn:'2026-09-20',
    displayFrom:'2026-09-01'}};
  const place = {openingHours:{weekly:{jeudi:'11h–20h'},dates:{'2026-09-20':'Fermé'}}};
  const html = api.buildHours(place,now,settings,{});
  assert.equal((html.match(/Non renseigné/g)||[]).length,4);
  assert(html.includes('Fermé'));
  assert(!html.includes('11h–20h'));
  assert.equal(api.activeHoursPeriod({...now,date:'2026-09-21'},settings),null);
  assert.equal(api.activeHoursPeriod({...now,date:'2026-08-31'},settings),null);
});
test('Invalid and reversed periods safely retain weekly hours', () => {
  for (const period of [
    {startsOn:'2026-02-30',endsOn:'2026-03-02'},
    {startsOn:'2026-09-20',endsOn:'2026-09-16'},
    {startsOn:'2026-09-16',endsOn:'2026-09-20',displayFrom:'bad'}
  ]) assert.equal(api.activeHoursPeriod(now,{...cfg,hoursPeriod:period}),null);
});
test('Week order is opt-in and today keeps its own state', () => {
  const place = {openingHours:{weekly:{}}};
  const week = api.buildHours(place, now, {...cfg,hoursOrder:'week'}, {});
  assert(week.indexOf('Lundi') < week.indexOf('Jeudi'));
  assert(week.indexOf('Jeudi') < week.indexOf('Dimanche'));
  assert.match(week, /cb-card__hours-row locb-card__hours-row is-today[^>]*><span[^>]*>Jeudi/);
  const legacy = api.buildHours(place, now, cfg, {});
  assert(legacy.indexOf('Jeudi') < legacy.indexOf('Lundi'));
});
