'use strict';

(function () {
  const INSURANCE_NAMES = {
    none: 'Brak ubezpieczenia',
    basic: 'Podstawowe — 40%',
    extended: 'Rozszerzone — 60%',
    advanced: 'Zaawansowane — 80%',
  };
  const INSURANCE_RATES = { none: 0, basic: 0.4, extended: 0.6, advanced: 0.8 };

  function text(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value ?? '');
  }

  function number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeItems(rawItems) {
    if (!Array.isArray(rawItems)) return [];
    return rawItems.map((raw, index) => {
      const qty = Math.max(1, Math.floor(number(raw?.qty, 1)));
      const hasUnitPrice = Number.isFinite(Number(raw?.unitPrice));
      const storedPrice = Math.max(0, number(raw?.price, 0));
      const unitPrice = hasUnitPrice
        ? Math.max(0, number(raw.unitPrice, 0))
        : qty > 1
          ? window.roundMoney(storedPrice / qty)
          : storedPrice;
      const lineTotal = Number.isFinite(Number(raw?.lineTotal))
        ? Math.max(0, window.roundMoney(raw.lineTotal))
        : window.roundMoney(unitPrice * qty);
      return {
        id: raw?.id || `item-${index + 1}`,
        label: raw?.label || raw?.name || `Pozycja ${index + 1}`,
        qty,
        unitPrice,
        lineTotal,
      };
    }).filter((item) => item.lineTotal >= 0);
  }

  function showMissingInvoice() {
    const documentNode = document.getElementById('invoiceDoc');
    if (!documentNode) return;
    documentNode.textContent = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Brak zapisanego rachunku';
    const paragraph = document.createElement('p');
    paragraph.textContent = 'Wróć do taryfikatora, wybierz usługi i wygeneruj rachunek.';
    documentNode.append(heading, paragraph);
  }

  function renderInvoice() {
    const data = window.readStoredJSON('lastInvoice', null);
    if (!data || typeof data !== 'object') {
      showMissingInvoice();
      return;
    }

    const items = normalizeItems(data.items);
    const computedSubtotal = window.roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const storedSubtotal = number(data.subtotal, NaN);
    // Pozycje są źródłem prawdy. Stara wersja zapisywała różne znaczenie pola price.
    const subtotal = items.length ? computedSubtotal : Math.max(0, number(storedSubtotal, number(data.total, 0)));
    const insuranceType = data.insuranceType || 'none';
    const rate = Math.min(Math.max(number(data.insuranceRate, INSURANCE_RATES[insuranceType] || 0), 0), 1);
    const discount = window.roundMoney(subtotal * rate);
    const total = window.roundMoney(Math.max(0, subtotal - discount));
    const date = data.date || (data.createdAt
      ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.createdAt))
      : new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()));

    text('docRef', data.ref || `MW-${Math.floor(100000 + Math.random() * 900000)}`);
    text('docDate', date);
    text('docPatient', data.patient || 'NIEZNANY');
    text('docDoctor', data.doctor || data.ems || 'DYŻURNY LEKARZ');
    text('docDoctor2', data.doctor || data.ems || 'DYŻURNY LEKARZ');
    text('docInsurance', data.insuranceLabel || INSURANCE_NAMES[insuranceType] || 'Brak ubezpieczenia');
    text('docPolicy', data.policy || data.insuranceId || 'BRAK');
    text('docSubtotal', window.formatMoney(subtotal));
    text('docDiscount', `-${window.formatMoney(discount)}`);
    text('docTotal', window.formatMoney(total));

    const body = document.getElementById('docItems');
    if (!body) return;
    body.textContent = '';

    if (!items.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 3;
      cell.textContent = 'Brak pozycji na rachunku.';
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }

    items.forEach((item) => {
      const row = document.createElement('tr');
      const name = document.createElement('td');
      const qty = document.createElement('td');
      const cost = document.createElement('td');
      name.textContent = item.label;
      qty.textContent = String(item.qty);
      qty.style.textAlign = 'center';
      cost.textContent = window.formatMoney(item.lineTotal);
      cost.style.textAlign = 'right';
      row.append(name, qty, cost);
      body.appendChild(row);
    });
  }

  document.addEventListener('DOMContentLoaded', renderInvoice);
})();
