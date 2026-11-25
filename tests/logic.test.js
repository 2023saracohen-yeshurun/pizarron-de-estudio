const test = require('node:test');
const assert = require('node:assert/strict');
const {
  convertValue,
  validateConversion,
  createNote,
  updateNote,
  deleteNote,
  filterNotes,
  loadNotes,
} = require('../script.js');

test('convierte longitud y masa entre unidades de sus grupos', () => {
  assert.equal(convertValue(2, 'longitud', 'km', 'm'), 2000);
  assert.equal(convertValue(30, 'longitud', 'cm', 'm'), 0.3);
  assert.equal(convertValue(1, 'masa', 'kg', 'g'), 1000);
  assert.equal(convertValue(0, 'masa', 'g', 'kg'), 0);
  assert.throws(() => convertValue(1e308, 'longitud', 'km', 'cm'), RangeError);
});

test('convierte temperaturas y conserva precisión útil', () => {
  assert.equal(convertValue(0, 'temperatura', 'C', 'F'), 32);
  assert.equal(convertValue(0, 'temperatura', 'C', 'K'), 273.15);
  assert.equal(convertValue(32, 'temperatura', 'F', 'C'), 0);
  assert.equal(convertValue(273.15, 'temperatura', 'K', 'C'), 0);
});

test('rechaza cantidades vacías, no finitas, grupos incompatibles y temperaturas bajo cero absoluto', () => {
  for (const value of ['', '   ', NaN, Infinity, -Infinity]) {
    assert.equal(validateConversion(value, 'longitud', 'm', 'km').ok, false);
  }
  assert.equal(validateConversion(1, 'longitud', 'm', 'kg').ok, false);
  assert.equal(validateConversion(-273.15001, 'temperatura', 'C', 'K').ok, false);
  assert.equal(validateConversion(-459.67001, 'temperatura', 'F', 'C').ok, false);
  assert.equal(validateConversion(-0.00001, 'temperatura', 'K', 'C').ok, false);
  assert.equal(validateConversion(0, 'temperatura', 'C', 'K').ok, true);
  assert.equal(validateConversion(1, 'longitud', 'm', 'kg').ok, false);
});

test('crear, editar y borrar conservan identidad estable', () => {
  const created = createNote([], 'Leer capítulo 2', 'Lecturas', () => 'nota-fija');
  assert.deepEqual(created, [{ id: 'nota-fija', text: 'Leer capítulo 2', category: 'Lecturas' }]);
  const edited = updateNote(created, 'nota-fija', 'Releer capítulo 2', 'Dudas');
  assert.equal(edited[0].id, 'nota-fija');
  assert.equal(edited[0].text, 'Releer capítulo 2');
  assert.deepEqual(deleteNote(edited, 'nota-fija'), []);
  assert.deepEqual(createNote(created, '   ', 'Lecturas', () => 'nope'), created);
  assert.deepEqual(updateNote(created, 'nota-fija', 'texto', 'Otra'), created);
  assert.equal(filterNotes(edited, 'Dudas').length, 1);
  assert.equal(filterNotes(edited, 'Cálculos').length, 0);
});

test('carga datos JSON corruptos como lista vacía', () => {
  assert.deepEqual(loadNotes('{mal json'), []);
  assert.deepEqual(loadNotes('{"no":"es una lista"}'), []);
});
