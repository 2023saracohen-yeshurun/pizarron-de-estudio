'use strict';

const STORAGE_KEY = 'entre-lineas:pizarron-de-estudio:notas:v1';
const UNITS = {
  longitud: { m: 1, km: 1000, cm: 0.01 },
  masa: { kg: 1, g: 0.001 },
  temperatura: { C: 1, F: 1, K: 1 },
};
const CATEGORIES = ['Lecturas', 'Dudas', 'Cálculos'];

function parseFinite(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validateConversion(value, type, from, to) {
  const number = parseFinite(value);
  if (number === null) return { ok: false, message: 'Escribí un número finito para convertir.' };
  if (!UNITS[type] || !Object.hasOwn(UNITS[type], from) || !Object.hasOwn(UNITS[type], to)) {
    return { ok: false, message: 'Elegí unidades válidas del mismo tipo.' };
  }
  if (type === 'temperatura') {
    const kelvin = from === 'C' ? number + 273.15 : from === 'F' ? (number - 32) * 5 / 9 + 273.15 : number;
    if (kelvin < 0) return { ok: false, message: 'La temperatura no puede estar por debajo del cero absoluto.' };
  }
  return { ok: true, value: number };
}

function convertValue(value, type, from, to) {
  const validation = validateConversion(value, type, from, to);
  if (!validation.ok) throw new RangeError(validation.message);
  const number = validation.value;
  if (type === 'temperatura') {
    const celsius = from === 'C' ? number : from === 'F' ? (number - 32) * 5 / 9 : number - 273.15;
    const result = to === 'C' ? celsius : to === 'F' ? celsius * 9 / 5 + 32 : celsius + 273.15;
    if (!Number.isFinite(result)) throw new RangeError('El resultado excede el rango numérico.');
    return Object.is(result, -0) ? 0 : result;
  }
  const result = number * UNITS[type][from] / UNITS[type][to];
  if (!Number.isFinite(result)) throw new RangeError('El resultado excede el rango numérico.');
  return Object.is(result, -0) ? 0 : result;
}

function createNote(notes, text, category, idFactory = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`) {
  const cleanText = String(text ?? '').trim();
  if (!cleanText || !CATEGORIES.includes(category)) return notes.slice();
  return [{ id: idFactory(), text: cleanText, category }, ...notes];
}

function updateNote(notes, id, text, category) {
  const cleanText = String(text ?? '').trim();
  if (!cleanText || !CATEGORIES.includes(category)) return notes.slice();
  return notes.map(note => note.id === id ? { ...note, text: cleanText, category } : note);
}

function deleteNote(notes, id) {
  return notes.filter(note => note.id !== id);
}

function filterNotes(notes, category) {
  return category === 'Todas' ? notes.slice() : notes.filter(note => note.category === category);
}

function loadNotes(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(note => note && typeof note.id === 'string' && typeof note.text === 'string' && CATEGORIES.includes(note.category));
  } catch {
    return [];
  }
}

const logic = { STORAGE_KEY, CATEGORIES, convertValue, validateConversion, createNote, updateNote, deleteNote, filterNotes, loadNotes };
if (typeof module !== 'undefined' && module.exports) module.exports = logic;

if (typeof document !== 'undefined') {
  const $ = selector => document.querySelector(selector);
  const noteForm = $('#note-form');
  const noteText = $('#texto-nota');
  const noteCategory = $('#categoria-nota');
  const noteList = $('#note-list');
  const filter = $('#note-filter');
  const noteStatus = $('#note-status');
  const conversionForm = $('#conversion-form');
  const typeSelect = $('#tipo-conversion');
  const valueInput = $('#valor-origen');
  const fromSelect = $('#unidad-origen');
  const toSelect = $('#unidad-destino');
  const resultPanel = $('#resultado-conversion');
  const resultValue = $('#result-value');
  const conversionStatus = $('#conversion-status');
  const saveConversion = $('#save-conversion');
  let notes = [];
  let editingId = null;
  let currentResult = null;
  let storageAvailable = true;
  let corruptedStorage = false;

  try {
    const rawNotes = localStorage.getItem(STORAGE_KEY);
    notes = loadNotes(rawNotes);
    if (rawNotes !== null) {
      try {
        const parsedNotes = JSON.parse(rawNotes);
        corruptedStorage = !Array.isArray(parsedNotes) || parsedNotes.some(note => !note || typeof note.id !== 'string' || typeof note.text !== 'string' || !CATEGORIES.includes(note.category));
      } catch { corruptedStorage = true; }
    }
  } catch {
    storageAvailable = false;
  }

  function announce(element, message) { element.textContent = message; }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      storageAvailable = true;
      return true;
    } catch {
      storageAvailable = false;
      announce(noteStatus, 'No se pudo guardar en este navegador. Podés seguir usando el pizarrón mientras esta página esté abierta.');
      return false;
    }
  }
  function renderNotes() {
    noteList.replaceChildren();
    const visible = filterNotes(notes, filter.value);
    if (!visible.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = filter.value === 'Todas' ? 'Todavía no hay notas. Guardá una idea para volver a ella.' : 'No hay notas en esta categoría.';
      noteList.append(empty);
      return;
    }
    for (const note of visible) {
      const article = document.createElement('article');
      article.className = 'note-card';
      const category = document.createElement('p');
      category.className = 'categoria-nota';
      category.textContent = note.category;
      const content = document.createElement('p');
      content.className = 'note-content';
      content.textContent = note.text;
      const actions = document.createElement('div');
      actions.className = 'note-actions';
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'text-button'; edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar nota: ${note.text.slice(0, 60)}`);
      edit.addEventListener('click', () => {
        editingId = note.id; noteText.value = note.text; noteCategory.value = note.category;
        $('#note-submit').textContent = 'Guardar cambios'; $('#cancel-edit').hidden = false;
        noteText.focus(); announce(noteStatus, 'Editando nota.');
      });
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'text-button delete-button'; remove.textContent = 'Eliminar';
      remove.setAttribute('aria-label', `Eliminar nota: ${note.text.slice(0, 60)}`);
      remove.addEventListener('click', () => {
        notes = deleteNote(notes, note.id);
        if (editingId === note.id) clearEdit();
        persist(); renderNotes();
        announceSave('Nota eliminada.');
      });
      actions.append(edit, remove); article.append(category, content, actions); noteList.append(article);
    }
  }
  function clearEdit() {
    editingId = null; noteForm.reset(); $('#note-submit').textContent = 'Guardar nota'; $('#cancel-edit').hidden = true;
  }
  function announceSave(successMessage) {
    announce(noteStatus, storageAvailable ? successMessage : 'El cambio quedó disponible en esta página, pero no se pudo guardar en el navegador.');
  }
  noteForm.addEventListener('submit', event => {
    event.preventDefault();
    const text = noteText.value.trim();
    if (!text) { announce(noteStatus, 'Escribí una nota antes de guardar.'); noteText.focus(); return; }
    const wasEditing = editingId !== null;
    notes = wasEditing ? updateNote(notes, editingId, text, noteCategory.value) : createNote(notes, text, noteCategory.value);
    persist(); clearEdit(); renderNotes(); announceSave(wasEditing ? 'Nota actualizada.' : 'Nota guardada.');
  });
  $('#cancel-edit').addEventListener('click', () => { clearEdit(); announce(noteStatus, 'Edición cancelada.'); });
  filter.addEventListener('change', renderNotes);

  const unitOptions = {
    longitud: [['m', 'Metros (m)'], ['km', 'Kilómetros (km)'], ['cm', 'Centímetros (cm)']],
    masa: [['kg', 'Kilogramos (kg)'], ['g', 'Gramos (g)']],
    temperatura: [['C', 'Celsius (°C)'], ['F', 'Fahrenheit (°F)'], ['K', 'Kelvin (K)']],
  };
  function updateUnits() {
    const options = unitOptions[typeSelect.value];
    for (const select of [fromSelect, toSelect]) {
      const previous = select.value;
      select.replaceChildren(...options.map(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
      }));
      if (options.some(([value]) => value === previous)) select.value = previous;
    }
    invalidateResult();
  }
  function invalidateResult() {
    currentResult = null; resultPanel.hidden = true; saveConversion.disabled = true;
    announce(conversionStatus, '');
  }
  typeSelect.addEventListener('change', updateUnits);
  for (const control of [valueInput, fromSelect, toSelect]) control.addEventListener('input', invalidateResult);
  for (const control of [fromSelect, toSelect]) control.addEventListener('change', invalidateResult);
  conversionForm.addEventListener('submit', event => {
    event.preventDefault();
    const validity = validateConversion(valueInput.value, typeSelect.value, fromSelect.value, toSelect.value);
    if (!validity.ok) { invalidateResult(); announce(conversionStatus, validity.message); return; }
    let value;
    try {
      value = convertValue(validity.value, typeSelect.value, fromSelect.value, toSelect.value);
    } catch (error) {
      invalidateResult(); announce(conversionStatus, error.message); return;
    }
    if (!Number.isFinite(value)) { invalidateResult(); announce(conversionStatus, 'El resultado excede el rango numérico.'); return; }
    currentResult = { value, input: validity.value, type: typeSelect.value, from: fromSelect.value, to: toSelect.value };
    resultValue.textContent = `${new Intl.NumberFormat('es-AR', { maximumSignificantDigits: 10 }).format(value)} ${toSelect.value}`;
    resultPanel.hidden = false; saveConversion.disabled = false; announce(conversionStatus, 'Conversión realizada.');
  });
  saveConversion.addEventListener('click', () => {
    if (!currentResult) return;
    const { input, value, from, to } = currentResult;
    const text = `${input} ${from} = ${value} ${to}`;
    notes = createNote(notes, text, 'Cálculos'); persist(); renderNotes();
    announceSave('Conversión guardada en Cálculos.');
    $('#notes-heading').focus({ preventScroll: false });
  });

  updateUnits(); renderNotes();
  if (!storageAvailable) announce(noteStatus, 'El almacenamiento local no está disponible. Podés usar el pizarrón mientras esta página esté abierta.');
  else if (corruptedStorage) announce(noteStatus, 'Algunos datos guardados estaban dañados; se conservaron las notas que se pudieron leer.');
  else announce(noteStatus, 'Tus notas se guardan en este navegador.');
}
