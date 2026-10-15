(function () {
  const DEFECTS = window.__DEFECTS__ || {};

  const form = document.getElementById('customer-form');
  const message = document.getElementById('create-message');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search');
  const tbody = document.getElementById('customers-body');
  const emptyState = document.getElementById('empty-state');
  const listError = document.getElementById('list-error');
  const count = document.querySelector('[data-testid="customers-count"]');

  function showMessage(text, kind) {
    message.textContent = text;
    message.dataset.status = kind;
    message.className = `message ${kind}`;
    message.hidden = false;
  }

  function cell(text, testid) {
    const td = document.createElement('td');
    td.textContent = text;
    td.dataset.testid = testid;
    return td;
  }

  function render(customers) {
    tbody.replaceChildren();
    customers.forEach((c) => {
      const tr = document.createElement('tr');
      tr.dataset.testid = `customer-row-${c.id}`;
      tr.append(
        cell(c.id, 'customer-id'),
        cell(c.name, 'customer-name'),
        cell(c.email, 'customer-email'),
        cell(c.status, 'customer-status'),
        cell(new Date(c.created_at).toLocaleString('es'), 'customer-created-at')
      );
      tr.lastElementChild.previousElementSibling.classList.add('status', `status-${String(c.status).toLowerCase()}`);
      tbody.append(tr);
    });
    emptyState.hidden = customers.length > 0;
    count.textContent = `${customers.length} cliente(s)`;
  }

  async function loadCustomers() {
    const term = searchInput.value.trim();
    const url = term ? `/customers?search=${encodeURIComponent(term)}` : '/customers';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      listError.hidden = true;
      render(await res.json());
    } catch (err) {
      listError.textContent = `No se pudo cargar la lista de clientes (${err.message})`;
      listError.hidden = false;
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.value,
      email: form.email.value,
      status: form.status.value,
    };

    let res;
    let body = null;
    try {
      res = await fetch('/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      body = await res.json().catch(() => null);
    } catch (err) {
      showMessage('No se pudo conectar con el servidor', 'error');
      return;
    }

    if (DEFECTS.uiIgnoresCreateResponse) {
      // Defecto (d): muestra éxito sin mirar res.ok.
      showMessage('Cliente creado correctamente', 'success');
      form.reset();
    } else if (res.ok) {
      showMessage('Cliente creado correctamente', 'success');
      form.reset();
    } else {
      const msg = body && body.error ? body.error.message : `Error HTTP ${res.status}`;
      const details = body && body.error && body.error.details
        ? ': ' + body.error.details.map((d) => d.message).join('; ')
        : '';
      showMessage(`Error al crear el cliente. ${msg}${details}`, 'error');
    }
    loadCustomers();
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loadCustomers();
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    searchInput.value = '';
    loadCustomers();
  });

  loadCustomers();
})();
