'use strict';

(function () {
  const MONEY = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  window.formatMoney = function formatMoney(value) {
    const amount = Number(value);
    return MONEY.format(Number.isFinite(amount) ? amount : 0);
  };

  window.roundMoney = function roundMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 0;
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  };

  window.readStoredJSON = function readStoredJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value ?? fallback;
    } catch (error) {
      console.warn(`Nie udało się odczytać ${key}:`, error);
      return fallback;
    }
  };

  window.writeStoredJSON = function writeStoredJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Nie udało się zapisać ${key}:`, error);
      return false;
    }
  };

  let toastTimer = 0;
  window.showToast = function showToast(message, type) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = String(message || '');
    toast.className = `toast show${type ? ` ${type}` : ''}`;
    toastTimer = window.setTimeout(() => {
      toast.className = 'toast';
    }, 2600);
  };

  function updateClock() {
    const clock = document.getElementById('clock');
    if (!clock) return;
    clock.textContent = new Intl.DateTimeFormat('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date());
  }

  function waitForImages(element) {
    const images = Array.from(element.querySelectorAll('img'));
    return Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Nie udało się utworzyć obrazu PNG.'));
      }, 'image/png');
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  window.copyElementAsImage = async function copyElementAsImage(selector, button) {
    const element = document.querySelector(selector);
    if (!element) {
      showToast('Nie znaleziono dokumentu do skopiowania.', 'error');
      return;
    }
    if (typeof window.html2canvas !== 'function') {
      showToast('Biblioteka tworzenia PNG nie została załadowana.', 'error');
      return;
    }

    const originalLabel = button?.textContent || 'Kopiuj obraz';
    if (button) {
      button.disabled = true;
      button.textContent = 'Generowanie...';
    }

    try {
      if (document.fonts?.ready) await document.fonts.ready;
      await waitForImages(element);

      // Renderowany jest wyłącznie wskazany dokument, nie cały body/viewport.
      const width = Math.ceil(element.scrollWidth);
      const height = Math.ceil(element.scrollHeight);
      const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));

      const canvas = await window.html2canvas(element, {
        backgroundColor: '#ffffff',
        scale,
        logging: false,
        useCORS: true,
        allowTaint: false,
        width,
        height,
        scrollX: 0,
        scrollY: -window.scrollY,
      });

      const blob = await canvasToBlob(canvas);
      const clipboardSupported = window.isSecureContext && navigator.clipboard && window.ClipboardItem;

      if (clipboardSupported) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Obraz został skopiowany do schowka.', 'success');
      } else {
        downloadBlob(blob, selector.includes('prescription') ? 'medwest-recepta.png' : 'medwest-rachunek.png');
        showToast('Przeglądarka nie pozwala kopiować. PNG zostało pobrane.', 'success');
      }
    } catch (error) {
      console.error(error);
      showToast('Nie udało się skopiować obrazu. Spróbuj w Chrome lub Edge.', 'error');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    window.setInterval(updateClock, 1000);
  });
})();
