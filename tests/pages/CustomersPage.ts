import { Locator, Page, Response } from '@playwright/test';
import { CustomerStatus } from '../support/customers-api';

export interface NewCustomer {
  name: string;
  email: string;
  status?: CustomerStatus;
}

/**
 * Page Object de la pantalla de clientes ("/").
 *
 * Sincronización: cada acción espera la respuesta HTTP que dispara (waitForResponse);
 * no se usan esperas fijas. El resto se verifica con web-first assertions en los tests.
 */
export class CustomersPage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly statusSelect: Locator;
  readonly createButton: Locator;
  readonly createMessage: Locator;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly clearSearchButton: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly count: Locator;
  readonly emptyState: Locator;

  constructor(private readonly page: Page) {
    this.nameInput = page.getByTestId('input-name');
    this.emailInput = page.getByTestId('input-email');
    this.statusSelect = page.getByTestId('select-status');
    this.createButton = page.getByTestId('btn-create');
    this.createMessage = page.getByTestId('create-message');
    this.searchInput = page.getByTestId('search-input');
    this.searchButton = page.getByTestId('btn-search');
    this.clearSearchButton = page.getByTestId('btn-clear-search');
    this.table = page.getByTestId('customers-table');
    this.rows = page.getByTestId('customers-body').locator('[data-testid^="customer-row-"]');
    this.count = page.getByTestId('customers-count');
    this.emptyState = page.getByTestId('empty-state');
  }

  /** Fila de un cliente por id. */
  row(id: number): Locator {
    return this.page.getByTestId(`customer-row-${id}`);
  }

  /** Celda de una fila: 'customer-name' | 'customer-email' | 'customer-status' ... */
  cell(id: number, testId: string): Locator {
    return this.row(id).getByTestId(testId);
  }

  async goto(): Promise<void> {
    await Promise.all([this.waitForList(), this.page.goto('/')]);
  }

  async reload(): Promise<void> {
    await Promise.all([this.waitForList(), this.page.reload()]);
  }

  /**
   * Completa el formulario y envía el alta. Devuelve la respuesta del POST.
   * Espera también la recarga de la lista que el frontend dispara después del POST:
   * así una búsqueda posterior no compite con esa recarga (ver docs/05-e2e-testing.md).
   */
  async createCustomer(customer: NewCustomer): Promise<Response> {
    await this.nameInput.fill(customer.name);
    await this.emailInput.fill(customer.email);
    if (customer.status) await this.statusSelect.selectOption(customer.status);

    const [postResponse] = await Promise.all([
      this.page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/customers'),
      this.waitForList(),
      this.createButton.click(),
    ]);
    return postResponse;
  }

  /** Busca por nombre o email y espera la respuesta filtrada. */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await Promise.all([this.waitForList(term), this.searchButton.click()]);
  }

  async clearSearch(): Promise<void> {
    await Promise.all([this.waitForList(''), this.clearSearchButton.click()]);
  }

  /** Espera un GET /customers; si se indica term, solo el que corresponde a esa búsqueda. */
  private waitForList(term?: string): Promise<Response> {
    return this.page.waitForResponse((r) => {
      const url = new URL(r.url());
      if (r.request().method() !== 'GET' || url.pathname !== '/customers') return false;
      return term === undefined || (url.searchParams.get('search') ?? '') === term.trim();
    });
  }
}
