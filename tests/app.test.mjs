// Tests der App im simulierten Browser (jsdom). "Neuladen" = neue Seite mit dem gespeicherten Local Storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const KEY = 'dokumentationshelfer.v1';

function boot(saved = null, { confirm = true } = {}) {
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    url: 'https://example.test/dokumentationshelfer/',
    pretendToBeVisual: true,
    beforeParse(w) {
      w.localStorage.clear();
      if (saved) w.localStorage.setItem(KEY, saved);
      w.confirm = () => confirm;
    },
  });
  const w = dom.window;
  const $ = (s) => w.document.querySelector(s);
  return {
    w,
    $,
    click: (s) => $(s).click(),
    stepper: (src, path) => w.document.querySelector(`.stepper[data-src="${src}"][data-path="${path}"]`),
    plus(src, path, n = 1) { for (let i = 0; i < n; i++) this.stepper(src, path).querySelector('[data-dir="1"]').click(); },
    minus(src, path, n = 1) { for (let i = 0; i < n; i++) this.stepper(src, path).querySelector('[data-dir="-1"]').click(); },
    shown: (src, path) => w.document.querySelector(`.stepper[data-src="${src}"][data-path="${path}"] .val span`).textContent,
    store: () => JSON.parse(JSON.stringify(w.eval('store'))),
    importCsv: (t) => JSON.parse(JSON.stringify(w.importCsv(t))),
    saved: () => w.localStorage.getItem(KEY),
    select(sel, v) { const el = $(sel); el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); },
  };
}

function named(name = 'Testgerät') {
  const a = boot();
  a.$('#device-input').value = name;
  a.click('#device-save');
  return a;
}

test('erster Start fragt nach Gerätename, Name bleibt nach Neuladen', () => {
  const a = boot();
  assert.equal(a.$('#device-ov').hidden, false);
  a.$('#device-input').value = 'Handy 1';
  a.click('#device-save');
  const b = boot(a.saved());
  assert.equal(b.$('#device-ov').hidden, true);
  assert.equal(b.$('#device-btn').textContent, 'Handy 1');
});

test('Höhe: Standard 209, +/- mm-genau, Speichern mit Zeitstempel, übersteht Neuladen', () => {
  const a = named();
  assert.equal(a.shown('hoehe', 'min'), '209');
  a.minus('hoehe', 'min', 3);
  a.plus('hoehe', 'max', 5);
  assert.equal(a.shown('hoehe', 'min'), '206');
  assert.equal(a.shown('hoehe', 'max'), '214');
  assert.match(a.$('[data-status="hoehe.max"]').textContent, /außerhalb/);
  a.click('#save-btn');
  const e = a.store().entries[0];
  assert.deepEqual(e.data, { min: 206, max: 214 });
  assert.match(e.ts, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/);
  assert.equal(e.device, 'Testgerät');

  const b = boot(a.saved());
  assert.equal(b.store().entries.length, 1);
  assert.equal(b.store().entries[0].id, e.id);
  assert.equal(b.shown('hoehe', 'min'), '206', 'Eingabe (Entwurf) bleibt nach Neuladen erhalten');
  assert.match(b.$('#history-btn').textContent, /\(1\)/);
});

test('Höhe: vertauschte Werte werden beim Speichern sortiert', () => {
  const a = named();
  a.plus('hoehe', 'min', 4);
  a.minus('hoehe', 'max', 2);
  assert.equal(a.$('#hoehe-warn').hidden, false);
  a.click('#save-btn');
  assert.deepEqual(a.store().entries[0].data, { min: 207, max: 213 });
});

test('Eintippen per Tippen auf den Wert (Komma als Dezimaltrenner)', () => {
  const a = named();
  a.click('[data-tab="frisch"]');
  const st = a.stepper('frisch', 'vorne.g');
  st.querySelector('.val').click();
  const inp = st.querySelector('.val-input');
  assert.equal(inp.hidden, false);
  inp.value = '12,87';
  inp.dispatchEvent(new a.w.Event('blur'));
  assert.equal(a.shown('frisch', 'vorne.g'), '12,87');
});

test('Frischdichte: Steintyp setzt Standardgewicht, Dichte wie Dichterechner', () => {
  const a = named();
  a.click('[data-tab="frisch"]');
  assert.equal(a.shown('frisch', 'vorne.g'), '13,0');
  a.select('#frisch-typ', 'I2');
  assert.equal(a.shown('frisch', 'vorne.g'), '9,0');
  assert.equal(a.shown('frisch', 'hinten.g'), '9,0');
  a.plus('frisch', 'hinten.g', 2);
  assert.equal(a.shown('frisch', 'hinten.g'), '9,2');
  // 9 / (209 * 0,031) = 1,389 > 1,387
  assert.match(a.$('[data-density="frisch.vorne"]').textContent, /✓ Dichte 1,389/);
  a.click('#save-btn');
  const csv = a.w.buildCsv();
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 4, 'I2: drei Steine');
  assert.match(lines[1], /;frischdichte;.*;I2;;;vorne;;;9,00;209;1,389;/);
  assert.match(lines[2], /;mitte;;;9,00;209;1,389;/);
  assert.match(lines[3], /;hinten;;;9,20;209;1,420;/);
});

const visibleCards = (a) => [...a.w.document.querySelectorAll('.stone-card')].filter((c) => !c.hidden)
  .map((c) => c.querySelector('h2').textContent);

test('Frischdichte: I3 zwei Steine, I2 drei Steine mit klarer Beschriftung', () => {
  const a = named();
  a.click('[data-tab="frisch"]');
  assert.deepEqual(visibleCards(a), ['Stein vorne (Reihe 1)', 'Stein hinten (Reihe 2)']);
  a.select('#frisch-typ', 'I2');
  assert.deepEqual(visibleCards(a), ['Stein vorne (Reihe 1)', 'Stein Mitte (Reihe 2)', 'Stein hinten (Reihe 3)']);
  a.click('#save-btn');
  assert.deepEqual(Object.keys(a.store().entries[0].data), ['typ', 'vorne', 'mitte', 'hinten']);
  a.select('#frisch-typ', 'I3');
  a.click('#save-btn');
  assert.deepEqual(Object.keys(a.store().entries[1].data), ['typ', 'vorne', 'hinten']);
});

test('Frischdichte: nicht gemessener Stein wird leer gespeichert, Schalter übersteht Neuladen', () => {
  const a = named();
  a.click('[data-tab="frisch"]');
  a.select('#frisch-typ', 'I2');
  a.click('[data-toggle="mitte"]');
  const card = a.$('.stone-card[data-pos="mitte"]');
  assert.ok(card.classList.contains('off'));
  assert.equal(a.$('[data-toggle="mitte"]').textContent, 'nicht gemessen');

  const b = boot(a.saved());
  assert.ok(b.$('.stone-card[data-pos="mitte"]').classList.contains('off'));
  b.click('#save-btn');
  const d = b.store().entries[0].data;
  assert.equal(d.mitte, null);
  assert.deepEqual(d.vorne, { g: 9, h: 209 });
  const lines = b.w.buildCsv().trim().split('\r\n');
  assert.equal(lines.length, 4);
  assert.match(lines[2], /;I2;;;mitte;;;;;;/, 'Gewicht, Höhe und Dichte leer statt Standardwert');
  assert.match(b.$('#last-line').textContent, /Mitte –/);

  // Rundreise über CSV: leerer Stein bleibt leer
  const c = named('Gerät C');
  c.importCsv(b.w.buildCsv());
  assert.deepEqual(c.store().entries[0].data, d);
});

test('Frischdichte: ohne gemessenen Stein wird nicht gespeichert', () => {
  const a = named();
  a.click('[data-tab="frisch"]');
  a.click('[data-toggle="vorne"]');
  a.click('[data-toggle="hinten"]');
  a.click('#save-btn');
  assert.equal(a.store().entries.length, 0);
  assert.match(a.$('#toast-text').textContent, /Mindestens einen Stein/);
  a.click('[data-toggle="hinten"]');
  a.click('#save-btn');
  assert.equal(a.store().entries.length, 1);
  assert.equal(a.store().entries[0].data.vorne, null);
});

test('Frischdichte: Bearbeiten zeigt nicht gemessene Steine als aus und kann sie nachtragen', () => {
  const a = named();
  a.click('[data-tab="frisch"]');
  a.click('[data-toggle="hinten"]');
  a.click('#save-btn');
  const id = a.store().entries[0].id;
  a.click('[data-toggle="hinten"]'); // Entwurf wieder an
  a.click('#history-btn');
  a.$(`[data-edit="${id}"]`).click();
  assert.ok(a.$('.stone-card[data-pos="hinten"]').classList.contains('off'));
  a.click('[data-toggle="hinten"]');
  a.minus('frisch', 'hinten.g', 3);
  a.click('#save-btn');
  assert.deepEqual(a.store().entries[0].data.hinten, { g: 12.7, h: 209 });
  assert.equal(a.store().draft.frisch.hinten.off, false);
});

test('Gespeicherter Stand der Version 1.0 (ohne Mitte/Schalter) lädt weiter', () => {
  const old = JSON.parse(named().saved());
  old.draft.frisch = { typ: 'I3', vorne: { g: 12.5, h: 210 }, hinten: { g: 13.2, h: 208 } };
  old.entries = [{ id: 'x1', ts: '2026-10-09T12:00:00+02:00', device: 'A', kind: 'frisch', data: old.draft.frisch }];
  const a = boot(JSON.stringify(old));
  a.click('[data-tab="frisch"]');
  assert.equal(a.shown('frisch', 'vorne.g'), '12,5');
  a.select('#frisch-typ', 'I2');
  assert.equal(a.shown('frisch', 'mitte.g'), '9,0');
  assert.match(a.w.buildCsv(), /;hinten;;;13,20;208;/);
});

test('Brettdichte: I3 = 2×6, I2 = 3×6, Popup mit Weiter, Entwurf übersteht Neuladen', () => {
  const a = named();
  a.click('[data-tab="brett"]');
  assert.equal(a.w.document.querySelectorAll('#grid .cell').length, 12);
  a.$('#grid .cell[data-i="0"]').click();
  assert.equal(a.$('#stone-ov').hidden, false);
  assert.match(a.$('#stone-title').textContent, /Brett 1 · Reihe 1 \(vorne\) · Stein 1/);
  assert.equal(a.shown('popup', 'g'), '13,0');
  a.minus('popup', 'g', 2);
  a.click('#stone-next');
  assert.match(a.$('#stone-title').textContent, /Stein 2/);
  assert.equal(a.shown('popup', 'g'), '12,8', 'nächster Stein übernimmt den letzten Wert');
  a.plus('popup', 'g', 3);
  a.click('#stone-done');
  assert.equal(a.$('#stone-ov').hidden, true);

  const b = boot(a.saved());
  assert.equal(b.$('[data-panel="brett"]').hidden, false, 'Tab bleibt nach Neuladen');
  const stones = b.store().draft.brett.stones;
  assert.deepEqual(stones.slice(0, 3), [{ g: 12.8, h: 209 }, { g: 13.1, h: 209 }, null]);

  b.click('#save-btn'); // unvollständig, confirm = ja
  const e = b.store().entries[0];
  assert.equal(e.kind, 'brett');
  assert.equal(e.data.nr, 1);
  assert.equal(b.store().draft.brett.nr, 2);
  assert.equal(b.store().draft.brett.stones.filter(Boolean).length, 0);
  const rows = b.w.buildCsv().trim().split('\r\n');
  assert.equal(rows.length, 3);
  assert.match(rows[1], /;brettdichte;.*;I3;1;2x6;R1-S1;;;12,80;209;1,331;/);

  b.select('#brett-typ', 'I2');
  assert.equal(b.w.document.querySelectorAll('#grid .cell').length, 18);
});

test('Verlauf: Bearbeiten behält Zeitstempel, Löschen bleibt nach Neuladen gelöscht', () => {
  const a = named();
  a.click('#save-btn');
  a.plus('hoehe', 'max');
  a.click('#save-btn');
  const [e1, e2] = a.store().entries;

  a.click('#history-btn');
  assert.equal(a.w.document.querySelectorAll('#history-list li').length, 2);
  a.$(`[data-edit="${e1.id}"]`).click();
  assert.equal(a.$('#edit-banner').hidden, false);
  a.minus('hoehe', 'min', 4);
  a.click('#save-btn');
  const changed = a.store().entries.find((e) => e.id === e1.id);
  assert.deepEqual(changed.data, { min: 205, max: 209 });
  assert.equal(changed.ts, e1.ts);
  assert.ok(changed.edited);
  assert.equal(a.store().draft.hoehe.min, 209, 'Bearbeiten ändert den Entwurf nicht');

  a.click('#history-btn');
  a.$(`[data-del="${e2.id}"]`).click();
  assert.equal(a.store().entries.length, 1);

  const b = boot(a.saved());
  assert.equal(b.store().entries.length, 1);
  assert.deepEqual(b.store().entries[0].data, { min: 205, max: 209 });
});

test('Rückgängig nach Speichern entfernt den Eintrag', () => {
  const a = named();
  a.click('#save-btn');
  assert.equal(a.store().entries.length, 1);
  a.click('#toast-action');
  assert.equal(a.store().entries.length, 0);
  assert.equal(boot(a.saved()).store().entries.length, 0);
});

test('CSV zweier Geräte importieren: zusammengeführt nach Zeitstempel, Duplikate übersprungen', () => {
  const robert = named('Gerät A');
  robert.click('#save-btn');
  robert.click('[data-tab="frisch"]');
  robert.click('#save-btn');
  robert.click('[data-tab="brett"]');
  robert.$('#grid .cell[data-i="5"]').click();
  robert.click('#stone-done');
  robert.click('#save-btn');
  const csvA = robert.w.buildCsv();

  const helfer = named('Gerät B');
  helfer.plus('hoehe', 'max', 2);
  helfer.click('#save-btn');
  const csvB = helfer.w.buildCsv();

  const r1 = robert.importCsv(csvB);
  assert.deepEqual(r1, { added: 1, skipped: 0, bad: 0 });
  const r2 = robert.importCsv(csvA + '');
  assert.equal(r2.added, 0);
  assert.equal(r2.skipped, 3);
  const all = robert.store().entries;
  assert.equal(all.length, 4);
  assert.deepEqual(all.map((e) => e.ts), [...all.map((e) => e.ts)].sort());
  const brett = all.find((e) => e.kind === 'brett');

  // Rundreise: Export → Import auf leerem Gerät ergibt dieselben Daten
  const fresh = named('Gerät C');
  fresh.importCsv(robert.w.buildCsv());
  const imported = fresh.store().entries.find((e) => e.id === brett.id);
  assert.deepEqual(imported.data, brett.data);
  assert.equal(fresh.store().entries.length, 4);
});

test('Zwei offene Tabs überschreiben sich nicht gegenseitig', () => {
  const start = named().saved();
  const tab1 = boot(start);
  const tab2 = boot(start);
  tab1.click('#save-btn');
  // gemeinsamer Speicher: Tab 2 sieht den Stand von Tab 1 erst beim Schreiben
  tab2.w.localStorage.setItem(KEY, tab1.saved());
  tab2.click('#save-btn');
  assert.equal(JSON.parse(tab2.saved()).entries.length, 2);
});

test('Alle Daten löschen', () => {
  const a = named();
  a.click('#save-btn');
  a.click('#wipe');
  assert.equal(a.store().entries.length, 0);
  assert.equal(boot(a.saved()).store().entries.length, 0);
});
