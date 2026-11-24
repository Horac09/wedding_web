(() => {
  'use strict';

  function initRsvp() {
    const originalForm =
      document.getElementById('rsvp-form');

    if (!originalForm) {
      console.error('RSVP: formulář nebyl nalezen.');
      return;
    }

    const endpoint = originalForm.action;

    if (!endpoint || !endpoint.endsWith('/exec')) {
      console.error('RSVP: neplatná adresa action.');
      return;
    }

    /*
     * Odstranění starého iframe onload.
     * Načtení iframe není potvrzení uložení.
     */
    document.querySelectorAll('iframe').forEach(frame => {
      if (frame.name === originalForm.target) {
        frame.removeAttribute('onload');
        frame.onload = null;
      }
    });

    /*
     * Nový formulář bez původních inline handlerů
     * a bez dříve připojených event listenerů.
     */
    const form = document.createElement('form');
    form.id = 'rsvp-form';
    form.className = originalForm.className;
    form.action = endpoint;
    form.method = 'post';
    form.acceptCharset = 'UTF-8';
    form.target = 'rsvp_transport_v2';

    originalForm.replaceWith(form);

    const oldSuccess =
      document.getElementById('rsvp-success');

    if (oldSuccess) {
      oldSuccess.hidden = true;
      oldSuccess.classList.add('hidden');
    }

    if (!document.getElementById('rsvp-v2-styles')) {
      const style = document.createElement('style');
      style.id = 'rsvp-v2-styles';

      style.textContent = `
        #rsvp-form .rsvp-field {
          display: block;
          margin-bottom: 16px;
        }

        #rsvp-form .rsvp-field > span {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          font-weight: 500;
        }

        #rsvp-form input:not([type="checkbox"]):not([type="hidden"]),
        #rsvp-form select,
        #rsvp-form textarea {
          box-sizing: border-box;
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          background: #fff;
          color: #252525;
          font: inherit;
        }

        #rsvp-form textarea {
          min-height: 90px;
          resize: vertical;
        }

        #rsvp-form fieldset {
          min-width: 0;
          margin: 0 0 18px;
          padding: 18px;
          border: 1px solid #d1d5db;
          border-radius: 16px;
        }

        #rsvp-form legend {
          padding: 0 6px;
          font-weight: 600;
        }

        #rsvp-form .rsvp-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 16px;
        }

        #rsvp-form .rsvp-check {
          display: flex;
          align-items: center;
          gap: 9px;
          margin: 10px 0;
        }

        #rsvp-form .rsvp-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin: 18px 0;
        }

        #rsvp-form button {
          padding: 11px 18px;
          border: 1px solid #777;
          border-radius: 12px;
          cursor: pointer;
          font: inherit;
        }

        #rsvp-form .rsvp-primary {
          background: #3f5742;
          border-color: #3f5742;
          color: white;
        }

        #rsvp-form button:disabled {
          opacity: .6;
          cursor: wait;
        }

        #rsvp-form :focus-visible {
          outline: 3px solid #8b6f47;
          outline-offset: 3px;
        }

        #rsvp-form .rsvp-small {
          font-size: 12px;
          line-height: 1.6;
        }

        #rsvp-form [data-status] {
          margin-top: 16px;
          line-height: 1.6;
        }

        #rsvp-form [data-status]:focus {
          outline-offset: 4px;
        }

        #rsvp-form [hidden] {
          display: none !important;
        }

        @media (max-width: 600px) {
          #rsvp-form .rsvp-grid {
            grid-template-columns: 1fr;
          }
        }
      `;

      document.head.appendChild(style);
    }

    /*
     * innerHTML obsahuje pouze statickou šablonu.
     * Hodnoty zadané hosty do HTML nevkládáme.
     */
    form.innerHTML = `
      <div data-controls>
        <label class="rsvp-field">
          <span>Rodina nebo název skupiny *</span>
          <input
            data-family
            type="text"
            maxlength="150"
            autocomplete="section-rsvp organization"
            required
          >
        </label>

        <label class="rsvp-field">
          <span>E-mail nebo telefon, volitelné</span>
          <input
            data-contact
            type="text"
            maxlength="200"
          >
        </label>

        <div data-guests></div>

        <div class="rsvp-actions">
          <button type="button" data-add>
            Přidat hosta
          </button>
        </div>

        <label class="rsvp-field">
          <span>Vzkaz pro snoubence, volitelné</span>
          <textarea
            data-message
            maxlength="2000"
          ></textarea>
        </label>

        <div hidden>
          <label>
            Toto pole nevyplňujte
            <input
              data-website
              type="text"
              tabindex="-1"
              autocomplete="off"
            >
          </label>
        </div>

        <p class="rsvp-small">
          Údaje slouží k organizaci svatby.
          Uveďte jen potřebné informace o stravování,
          nikoli zdravotní diagnózy.
          Zájem o ubytování není potvrzením rezervace.
        </p>

        <div class="rsvp-actions">
          <button
            type="submit"
            class="rsvp-primary"
            data-submit
          >
            Odeslat odpověď
          </button>
        </div>
      </div>

      <input type="hidden" name="payload">

      <p
        data-status
        role="status"
        aria-live="polite"
        tabindex="-1"
      ></p>
    `;

    const frame = document.createElement('iframe');
    frame.name = 'rsvp_transport_v2';
    frame.title = 'Technický rámec odeslání formuláře';
    frame.hidden = true;
    document.body.appendChild(frame);

    const controls = form.querySelector('[data-controls]');
    const guestList = form.querySelector('[data-guests]');
    const addButton = form.querySelector('[data-add]');
    const submitButton = form.querySelector('[data-submit]');
    const statusBox = form.querySelector('[data-status]');
    const payloadInput = form.querySelector('[name="payload"]');

    let busy = false;
    let pending = null;

    function randomHex(bytes) {
      return Array.from(
        crypto.getRandomValues(new Uint8Array(bytes)),
        value => value.toString(16).padStart(2, '0')
      ).join('');
    }

    function setStatus(text, error = false) {
      statusBox.textContent = text;
      statusBox.style.color = error ? '#9b332a' : '#3f5742';
    }

    function renumberGuests() {
      const cards = [...guestList.children];

      cards.forEach((card, index) => {
        card.querySelector('legend').textContent =
          'Host ' + (index + 1);

        card.querySelector('[data-remove]').disabled =
          cards.length === 1;
      });

      addButton.disabled = cards.length >= 30;
    }

    function addGuest(focus = false) {
      if (guestList.children.length >= 30) {
        return;
      }

      const card = document.createElement('fieldset');

      card.innerHTML = `
        <legend>Host</legend>

        <label class="rsvp-field">
          <span>Jméno a příjmení *</span>
          <input
            data-name
            type="text"
            maxlength="120"
            required
          >
        </label>

        <div class="rsvp-grid">
          <label class="rsvp-field">
            <span>Kategorie</span>
            <select data-type>
              <option value="dospely">Dospělý</option>
              <option value="dite">Dítě</option>
            </select>
          </label>

          <label class="rsvp-field">
            <span>Účast</span>
            <select data-attendance>
              <option value="ano_cely_den">
                Celý den včetně hostiny
              </option>
              <option value="pouze_obrad">
                Pouze obřad
              </option>
              <option value="ne">
                Nezúčastní se
              </option>
            </select>
          </label>
        </div>

        <div data-attending>
          <label class="rsvp-check">
            <input data-sleep type="checkbox">
            <span>Mám zájem o ubytování</span>
          </label>

          <p class="rsvp-small">Stravovací požadavky:</p>

          <label class="rsvp-check">
            <input
              data-diet
              type="checkbox"
              value="Vegetarián"
            >
            <span>Vegetarián</span>
          </label>

          <label class="rsvp-check">
            <input
              data-diet
              type="checkbox"
              value="Vegan"
            >
            <span>Vegan</span>
          </label>

          <label class="rsvp-check">
            <input
              data-diet
              type="checkbox"
              value="Bezlepková"
            >
            <span>Bezlepková strava</span>
          </label>

          <label class="rsvp-check">
            <input
              data-diet
              type="checkbox"
              value="Bez laktózy"
            >
            <span>Bez laktózy</span>
          </label>

          <label class="rsvp-field">
            <span>
              Další požadavky na stravu, volitelné
            </span>
            <textarea
              data-note
              maxlength="500"
            ></textarea>
          </label>
        </div>

        <button type="button" data-remove>
          Odebrat hosta
        </button>
      `;

      const attendance =
        card.querySelector('[data-attendance]');

      attendance.addEventListener('change', () => {
        card.querySelector('[data-attending]').hidden =
          attendance.value === 'ne';
      });

      card.querySelector('[data-remove]')
        .addEventListener('click', () => {
          if (guestList.children.length > 1) {
            card.remove();
            renumberGuests();
          }
        });

      guestList.appendChild(card);
      renumberGuests();

      if (focus) {
        card.querySelector('[data-name]').focus();
      }
    }

    function collectData() {
      return {
        family: form.querySelector('[data-family]')
          .value.trim(),

        contact: form.querySelector('[data-contact]')
          .value.trim(),

        message: form.querySelector('[data-message]')
          .value.trim(),

        website: form.querySelector('[data-website]')
          .value,

        guests: [...guestList.children].map(card => {
          const attendance =
            card.querySelector('[data-attendance]').value;

          const absent = attendance === 'ne';

          return {
            name: card.querySelector('[data-name]')
              .value.trim(),

            type: card.querySelector('[data-type]').value,

            attendance: attendance,

            sleep: !absent &&
              card.querySelector('[data-sleep]').checked,

            diets: absent
              ? []
              : [...card.querySelectorAll('[data-diet]:checked')]
                  .map(input => input.value),

            note: absent
              ? ''
              : card.querySelector('[data-note]')
                  .value.trim()
          };
        })
      };
    }

    function requestStatus(id) {
      return new Promise((resolve, reject) => {
        const callback =
          'weddingStatus_' + randomHex(8);

        const script = document.createElement('script');
        let timer;

        function cleanup() {
          clearTimeout(timer);
          script.remove();
          delete window[callback];
        }

        window[callback] = result => {
          cleanup();
          resolve(result);
        };

        script.onerror = () => {
          cleanup();
          reject(new Error('Odpověď serveru nelze načíst.'));
        };

        const url = new URL(endpoint);
        url.searchParams.set('id', id);
        url.searchParams.set('callback', callback);
        url.searchParams.set('_', String(Date.now()));

        script.src = url.href;

        timer = setTimeout(() => {
          cleanup();
          reject(new Error('Vypršel čas kontroly.'));
        }, 8000);

        document.head.appendChild(script);
      });
    }

    async function waitForConfirmation(id) {
      const deadline = Date.now() + 60000;

      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (Date.now() >= deadline) {
          break;
        }

        try {
          const result = await requestStatus(id);

          if (
            result &&
            result.id === id &&
            result.status === 'success'
          ) {
            return true;
          }
        } catch (error) {
          console.warn(
            'RSVP: kontrola uložení zatím nebyla úspěšná.'
          );
        }
      }

      return false;
    }

    addButton.addEventListener('click', () => {
      addGuest(true);
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (busy || !form.reportValidity()) {
        return;
      }

      try {
        const data = collectData();

        if (
          !data.family ||
          data.guests.some(guest => !guest.name)
        ) {
          setStatus(
            'Vyplňte název rodiny a jména všech hostů.',
            true
          );
          return;
        }

        const serialized = JSON.stringify(data);

        /*
         * Opakování stejného obsahu v této otevřené
         * stránce použije stejné ID.
         */
        if (!pending || pending.serialized !== serialized) {
          pending = {
            serialized: serialized,
            id: randomHex(32)
          };
        }

        payloadInput.value = JSON.stringify({
          ...data,
          id: pending.id
        });

        busy = true;
        submitButton.disabled = true;

        setStatus('Odesíláme a ověřujeme uložení…');

        /*
         * Nativní POST do iframe.
         * Nevoláme původní onsubmit ani staré funkce.
         */
        HTMLFormElement.prototype.submit.call(form);

        controls.inert = true;

        const confirmed =
          await waitForConfirmation(pending.id);

        if (confirmed) {
          form.reset();
          guestList.replaceChildren();
          addGuest();

          pending = null;
          payloadInput.value = '';

          setStatus(
            'Děkujeme! Vaše odpověď je uložená.'
          );
        } else {
          setStatus(
            'Uložení se nepodařilo ověřit. ' +
            'Údaje zůstaly vyplněné. ' +
            'Bez jejich změny můžete odeslání zopakovat. ' +
            'Pokud problém trvá, kontaktujte snoubence.',
            true
          );
        }

      } catch (error) {
        console.error('RSVP:', error);

        setStatus(
          'Odeslání se nepodařilo dokončit. ' +
          'Údaje zůstaly vyplněné.',
          true
        );

      } finally {
        busy = false;
        controls.inert = false;
        submitButton.disabled = false;
        renumberGuests();
      }
    });

    addGuest();

    console.info('RSVP-2: formulář je připraven.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initRsvp,
      { once: true }
    );
  } else {
    initRsvp();
  }
})();