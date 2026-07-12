'use strict';

(function () {
  function value(id, fallback) {
    const node = document.getElementById(id);
    if (!node) return fallback;
    const result = String(node.value || '').trim();
    return result || fallback;
  }

  function text(id, content) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(content ?? '');
  }

  window.applyPresetNotes = function applyPresetNotes() {
    const preset = document.getElementById('presetNotes');
    const notes = document.getElementById('notes');
    if (!preset || !notes || !preset.value) return;
    const existing = notes.value.trim();
    notes.value = existing ? `${existing}\n${preset.value}` : preset.value;
    preset.value = '';
    notes.focus();
  };

  function generateReference() {
    const year = new Date().getFullYear();
    return `RX-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  window.generatePrescription = function generatePrescription() {
    const packsRaw = Math.floor(Number(document.getElementById('packs')?.value || 1));
    const packs = Number.isFinite(packsRaw) ? Math.min(Math.max(packsRaw, 1), 10) : 1;
    const now = new Date();
    const prescription = {
      version: 3,
      ref: generateReference(),
      patient: value('patient', 'NIEZNANY'),
      doctor: value('doctor', 'DYŻURNY LEKARZ'),
      medicine: value('medicine', 'Brak danych'),
      packs,
      dosage: value('dosage', 'Według zaleceń lekarza'),
      duration: value('duration', 'Do odwołania'),
      priority: value('priority', 'Standardowa'),
      validity: value('validity', '30 dni'),
      notes: value('notes', 'Brak dodatkowych zaleceń.'),
      createdAt: now.toISOString(),
      date: new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(now),
    };

    if (!window.writeStoredJSON('lastPrescription', prescription)) {
      window.showToast('Nie udało się zapisać recepty.', 'error');
      return;
    }
    window.location.href = 'recepta_wydruk.html';
  };

  function renderPrescription() {
    if (!document.getElementById('rxDoc')) return;
    const data = window.readStoredJSON('lastPrescription', null);
    if (!data || typeof data !== 'object') {
      const doc = document.getElementById('rxDoc');
      doc.textContent = '';
      const heading = document.createElement('h2');
      heading.textContent = 'Brak zapisanej recepty';
      const paragraph = document.createElement('p');
      paragraph.textContent = 'Wróć do formularza i wygeneruj receptę.';
      doc.append(heading, paragraph);
      return;
    }

    text('rx_ref', data.ref || generateReference());
    text('rx_date', data.date || new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()));
    text('rx_patient', data.patient || 'NIEZNANY');
    text('rx_doctor', data.doctor || 'DYŻURNY LEKARZ');
    text('rx_sign', data.doctor || 'DYŻURNY LEKARZ');
    text('rx_medicine', data.medicine || 'Brak danych');
    text('rx_packs', data.packs || 1);
    text('rx_priority', data.priority || 'Standardowa');
    text('rx_validity', data.validity || '30 dni');
    text('rx_dosage', data.dosage || 'Według zaleceń lekarza');
    text('rx_duration', data.duration || 'Do odwołania');
    text('rx_notes', data.notes || 'Brak dodatkowych zaleceń.');
  }

  document.addEventListener('DOMContentLoaded', renderPrescription);
})();
