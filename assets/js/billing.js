'use strict';

(function () {
  const PRICE_STORAGE_KEY = 'medwest_prices_v3';
  const INVOICE_STORAGE_KEY = 'lastInvoice';
  const ADMIN_PASSWORD = 'kcandrzej';

  const categories = Array.isArray(window.MEDWEST_SERVICES) ? window.MEDWEST_SERVICES : [];
  const serviceMap = new Map();
  const defaultPrices = {};
  const selections = new Map();
  let prices = {};
  let currentSummary = { items: [], subtotal: 0, discount: 0, total: 0, rate: 0 };

  categories.forEach((category) => {
    category.services.forEach((service) => {
      serviceMap.set(service.id, service);
      defaultPrices[service.id] = Number(service.price) || 0;
    });
  });

  function normalizePrices(saved) {
    const result = { ...defaultPrices };
    if (!saved || typeof saved !== 'object') return result;
    Object.keys(result).forEach((id) => {
      const value = Number(saved[id]);
      if (Number.isFinite(value) && value >= 0) result[id] = window.roundMoney(value);
    });
    return result;
  }

  function getInsurance() {
    const select = document.getElementById('insuranceType');
    const option = select?.selectedOptions?.[0];
    const rate = Number(option?.dataset?.rate || 0);
    return {
      type: select?.value || 'none',
      label: option?.textContent?.trim() || 'Brak ubezpieczenia',
      rate: Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 1) : 0,
    };
  }

  function sanitizeQuantity(value, mode) {
    if (mode !== 'qty') return value ? 1 : 0;
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number) || number < 1) return 0;
    return Math.min(number, 999);
  }

  function createServiceRow(service) {
    const row = document.createElement('div');
    row.className = 'service-row';
    row.dataset.serviceId = service.id;
    row.dataset.search = `${service.name} ${service.label} ${service.id}`.toLocaleLowerCase('pl-PL');

    const name = document.createElement('div');
    name.className = 'service-name';
    const strong = document.createElement('strong');
    strong.textContent = service.label;
    const hint = document.createElement('span');
    hint.textContent = service.mode === 'qty' ? 'Cena za jedną sztukę / jednostkę' : 'Pozycja jednorazowa';
    name.append(strong, hint);

    const price = document.createElement('div');
    price.className = 'service-price';
    price.dataset.priceFor = service.id;
    price.textContent = window.formatMoney(prices[service.id]);

    const control = document.createElement('div');
    control.className = 'service-control';

    if (service.mode === 'qty') {
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '999';
      input.step = '1';
      input.value = '0';
      input.setAttribute('aria-label', `Ilość: ${service.label}`);
      input.addEventListener('input', () => {
        const quantity = sanitizeQuantity(input.value, 'qty');
        selections.set(service.id, quantity);
        if (input.value !== '' && Number(input.value) > 999) input.value = '999';
        calculate();
      });
      control.appendChild(input);
    } else {
      const label = document.createElement('label');
      label.className = 'service-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('aria-label', `Wybierz: ${service.label}`);
      input.addEventListener('change', () => {
        selections.set(service.id, input.checked ? 1 : 0);
        calculate();
      });
      label.appendChild(input);
      control.appendChild(label);
    }

    row.append(name, price, control);
    return row;
  }

  function renderServices() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    list.textContent = '';

    categories.forEach((category, categoryIndex) => {
      const details = document.createElement('details');
      details.className = 'category-card';
      if (categoryIndex === 0) details.open = true;

      const summary = document.createElement('summary');
      const label = document.createElement('span');
      label.textContent = category.label;
      const count = document.createElement('span');
      count.className = 'category-count';
      count.textContent = `${category.services.length} pozycji`;
      summary.append(label, count);

      const rows = document.createElement('div');
      rows.className = 'service-list';
      category.services.forEach((service) => rows.appendChild(createServiceRow(service)));

      details.append(summary, rows);
      list.appendChild(details);
    });
  }

  function collectItems() {
    const items = [];
    serviceMap.forEach((service, id) => {
      const quantity = sanitizeQuantity(selections.get(id), service.mode);
      if (!quantity) return;
      const unitPrice = window.roundMoney(prices[id]);
      const lineTotal = window.roundMoney(unitPrice * quantity);
      items.push({
        id,
        name: service.name,
        label: service.label,
        qty: quantity,
        unitPrice,
        lineTotal,
        // price pozostaje dla zgodności ze starszym rachunkiem.
        price: lineTotal,
      });
    });
    return items;
  }

  window.calculate = function calculate() {
    const items = collectItems();
    const subtotal = window.roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const insurance = getInsurance();
    const discount = window.roundMoney(subtotal * insurance.rate);
    const total = window.roundMoney(Math.max(0, subtotal - discount));

    currentSummary = { items, subtotal, discount, total, rate: insurance.rate, insurance };

    const finalNode = document.getElementById('final');
    const countNode = document.getElementById('selectedCount');
    const subtotalNode = document.getElementById('subtotal');
    const discountNode = document.getElementById('discount');
    if (finalNode) finalNode.textContent = window.formatMoney(total);
    if (countNode) countNode.textContent = String(items.length);
    if (subtotalNode) subtotalNode.textContent = window.formatMoney(subtotal);
    if (discountNode) discountNode.textContent = `-${window.formatMoney(discount)}`;

    renderSelectedList(items);
    return currentSummary;
  };

  function renderSelectedList(items) {
    const list = document.getElementById('selectedList');
    if (!list) return;
    list.textContent = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'selected-empty';
      empty.textContent = 'Nie wybrano jeszcze żadnych usług.';
      list.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'selected-item';
      const name = document.createElement('span');
      name.textContent = `${item.label}${item.qty > 1 ? ` × ${item.qty}` : ''}`;
      const total = document.createElement('strong');
      total.textContent = window.formatMoney(item.lineTotal);
      row.append(name, total);
      list.appendChild(row);
    });
  }

  function renderAdmin() {
    const grid = document.getElementById('adminGrid');
    if (!grid) return;
    grid.textContent = '';
    categories.forEach((category) => {
      category.services.forEach((service) => {
        const item = document.createElement('div');
        item.className = 'admin-item';
        const label = document.createElement('label');
        label.setAttribute('for', `price-${service.id}`);
        label.textContent = service.label;
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `price-${service.id}`;
        input.min = '0';
        input.step = '0.01';
        input.value = String(prices[service.id]);
        input.dataset.priceId = service.id;
        item.append(label, input);
        grid.appendChild(item);
      });
    });
  }

  window.openAdmin = function openAdmin() {
    const password = window.prompt('Podaj hasło admina:');
    if (password === null) return;
    if (password !== ADMIN_PASSWORD) {
      window.showToast('Błędne hasło.', 'error');
      return;
    }
    const panel = document.getElementById('adminPanel');
    if (!panel) return;
    renderAdmin();
    panel.classList.add('visible');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  window.savePrices = function savePrices() {
    const next = { ...prices };
    document.querySelectorAll('[data-price-id]').forEach((input) => {
      const value = Number(input.value);
      if (Number.isFinite(value) && value >= 0) next[input.dataset.priceId] = window.roundMoney(value);
    });
    prices = normalizePrices(next);
    if (!window.writeStoredJSON(PRICE_STORAGE_KEY, prices)) {
      window.showToast('Nie udało się zapisać cen.', 'error');
      return;
    }
    document.querySelectorAll('[data-price-for]').forEach((node) => {
      node.textContent = window.formatMoney(prices[node.dataset.priceFor]);
    });
    calculate();
    window.showToast('Ceny zostały zapisane.', 'success');
  };

  window.resetPrices = function resetPrices() {
    if (!window.confirm('Przywrócić wszystkie domyślne ceny?')) return;
    localStorage.removeItem(PRICE_STORAGE_KEY);
    prices = { ...defaultPrices };
    renderAdmin();
    document.querySelectorAll('[data-price-for]').forEach((node) => {
      node.textContent = window.formatMoney(prices[node.dataset.priceFor]);
    });
    calculate();
    window.showToast('Przywrócono domyślne ceny.', 'success');
  };

  function generateReference() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replaceAll('-', '');
    const random = Math.floor(100000 + Math.random() * 900000);
    return `MW-${date}-${random}`;
  }

  window.generateInvoice = function generateInvoice() {
    const summary = calculate();
    if (!summary.items.length) {
      window.showToast('Wybierz przynajmniej jedną usługę.', 'error');
      return;
    }

    const patient = document.getElementById('patientName')?.value.trim() || 'NIEZNANY';
    const doctor = document.getElementById('doctorName')?.value.trim() || 'DYŻURNY LEKARZ';
    const policy = document.getElementById('policyNumber')?.value.trim() || 'BRAK';
    const insurance = getInsurance();
    const now = new Date();

    const invoice = {
      version: 3,
      ref: generateReference(),
      patient,
      doctor,
      ems: doctor,
      policy,
      insuranceId: policy,
      insuranceType: insurance.type,
      insuranceLabel: insurance.label,
      insuranceRate: insurance.rate,
      items: summary.items,
      subtotal: summary.subtotal,
      discount: summary.discount,
      total: summary.total,
      createdAt: now.toISOString(),
      date: new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(now),
    };

    if (!window.writeStoredJSON(INVOICE_STORAGE_KEY, invoice)) {
      window.showToast('Nie udało się zapisać rachunku.', 'error');
      return;
    }
    window.location.href = 'rachunek.html';
  };

  function setupSearch() {
    const search = document.getElementById('serviceSearch');
    if (!search) return;
    search.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase('pl-PL');
      let visibleCount = 0;
      document.querySelectorAll('.category-card').forEach((category) => {
        let categoryVisible = 0;
        category.querySelectorAll('.service-row').forEach((row) => {
          const visible = !query || row.dataset.search.includes(query);
          row.hidden = !visible;
          if (visible) categoryVisible += 1;
        });
        category.hidden = categoryVisible === 0;
        if (query && categoryVisible) category.open = true;
        visibleCount += categoryVisible;
      });

      let empty = document.getElementById('serviceNoResults');
      if (!visibleCount && query) {
        if (!empty) {
          empty = document.createElement('div');
          empty.id = 'serviceNoResults';
          empty.className = 'no-results';
          empty.textContent = 'Nie znaleziono pasujących usług.';
          document.getElementById('categoryList')?.appendChild(empty);
        }
      } else {
        empty?.remove();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    prices = normalizePrices(window.readStoredJSON(PRICE_STORAGE_KEY, null));
    renderServices();
    setupSearch();
    calculate();
  });
})();
