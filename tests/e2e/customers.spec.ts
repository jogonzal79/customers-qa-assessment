import { test, expect } from '../fixtures/test-fixtures';
import { SEED, uniqueEmail } from '../support/test-data';

test.describe('Gestión de clientes', () => {
  test(
    'TC-19 alta desde la UI: el cliente aparece en la búsqueda con su status y existe en la API',
    { tag: ['@positive', '@e2e'], annotation: { type: 'tc', description: 'TC-19' } },
    async ({ customersPage, api }) => {
      const customer = { name: 'Elena Ruiz', email: uniqueEmail('elena.ruiz'), status: 'ACTIVE' as const };

      await test.step('Abrir la aplicación', async () => {
        await customersPage.goto();
        await expect(customersPage.table).toBeVisible();
      });

      const created = await test.step('Crear el cliente desde el formulario', async () => {
        const response = await customersPage.createCustomer(customer);
        expect(response.status(), 'POST /customers debe responder 201').toBe(201);
        await expect(customersPage.createMessage).toHaveAttribute('data-status', 'success');
        await expect(customersPage.createMessage).toHaveText('Cliente creado correctamente');
        return response.json();
      });

      await test.step('Buscarlo por nombre', async () => {
        await customersPage.search(customer.name);
        await expect(customersPage.rows).toHaveCount(1);
        await expect(customersPage.row(created.id)).toBeVisible();
      });

      await test.step('Buscarlo por email y validar la fila y el status', async () => {
        await customersPage.search(customer.email);
        await expect(customersPage.rows).toHaveCount(1);
        await expect(customersPage.count).toHaveText('1 cliente(s)');
        await expect(customersPage.cell(created.id, 'customer-name')).toHaveText(customer.name);
        await expect(customersPage.cell(created.id, 'customer-email')).toHaveText(customer.email);
        await expect(customersPage.cell(created.id, 'customer-status')).toHaveText('ACTIVE');
      });

      await test.step('Verificar por API que el cliente existe con los mismos datos', async () => {
        const stored = await api.getCustomer(created.id);
        expect(stored).toMatchObject({ id: created.id, name: customer.name, email: customer.email, status: 'ACTIVE' });
      });
    }
  );

  test(
    'TC-21 búsqueda sin resultados: muestra el estado vacío y al limpiar vuelve el listado',
    { tag: ['@negative'], annotation: { type: 'tc', description: 'TC-21' } },
    async ({ customersPage }) => {
      await customersPage.goto();
      await expect(customersPage.rows).toHaveCount(SEED.count);

      await test.step('Buscar un término sin coincidencias', async () => {
        await customersPage.search('cliente-inexistente-zzz');
        await expect(customersPage.emptyState).toBeVisible();
        await expect(customersPage.rows).toHaveCount(0);
        await expect(customersPage.count).toHaveText('0 cliente(s)');
      });

      await test.step('Limpiar la búsqueda', async () => {
        await customersPage.clearSearch();
        await expect(customersPage.emptyState).toBeHidden();
        await expect(customersPage.rows).toHaveCount(SEED.count);
      });
    }
  );

  test(
    'TC-20 alta con email duplicado: la UI muestra el error que devuelve la API',
    {
      tag: ['@negative', '@known-risk'],
      annotation: [
        { type: 'tc', description: 'TC-20' },
        { type: 'risk', description: 'R-04 / TC-20: la UI informa éxito sin verificar la respuesta del POST' },
      ],
    },
    async ({ customersPage }) => {
      await customersPage.goto();
      await expect(customersPage.rows).toHaveCount(SEED.count);

      const response = await test.step('La API rechaza el alta con 409 Conflict', async () => {
        const res = await customersPage.createCustomer({ name: 'María Repetida', email: SEED.mariaGarcia.email });
        const body = await res.json();
        test.info().annotations.push({
          type: 'api-response',
          description: `POST /customers → ${res.status()} ${body?.error?.code ?? ''}`.trim(),
        });
        expect(res.status(), 'POST /customers con email duplicado debe responder 409').toBe(409);
        expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
        return res;
      });

      await test.step('La UI informa el error y no muestra éxito', async () => {
        await expect(customersPage.createMessage).toBeVisible();
        const shown = await customersPage.createMessage.getAttribute('data-status');
        const text = await customersPage.createMessage.textContent();
        test.info().annotations.push({
          type: 'ui-message',
          description: `data-status="${shown}" · texto="${text?.trim()}" (respuesta HTTP ${response.status()})`,
        });
        await expect(customersPage.createMessage, 'La UI debe reflejar el error de la API').toHaveAttribute('data-status', 'error');
        await expect(customersPage.createMessage).not.toHaveText('Cliente creado correctamente');
      });

      await test.step('La tabla no cambia', async () => {
        await expect(customersPage.rows).toHaveCount(SEED.count);
      });
    }
  );

  test(
    'TC-22 status cambiado por API se muestra actualizado en la UI',
    { tag: ['@integration'], annotation: { type: 'tc', description: 'TC-22' } },
    async ({ customersPage, api }) => {
      const { id, status: initialStatus } = SEED.anaMartinez;

      await customersPage.goto();
      await expect(customersPage.cell(id, 'customer-status')).toHaveText(initialStatus);

      await test.step('Cambiar el status por API', async () => {
        const updated = await api.updateStatus(id, 'ACTIVE');
        expect(updated.status).toBe('ACTIVE');
      });

      await test.step('Recargar y validar el status en la tabla', async () => {
        await customersPage.reload();
        await expect(customersPage.cell(id, 'customer-status')).toHaveText('ACTIVE');
        await expect(customersPage.rows).toHaveCount(SEED.count);
      });
    }
  );
});
