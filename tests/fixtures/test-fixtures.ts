import { test as base, expect } from '@playwright/test';
import { CustomersPage } from '../pages/CustomersPage';
import { CustomersApi } from '../support/customers-api';

type Fixtures = {
  api: CustomersApi;
  customersPage: CustomersPage;
  resetState: void;
};

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => {
    await use(new CustomersApi(request));
  },

  // Automático: cada test arranca con los 5 clientes semilla, sin depender de otros tests.
  resetState: [
    async ({ api }, use) => {
      await api.reset();
      await use();
    },
    { auto: true },
  ],

  customersPage: async ({ page }, use) => {
    await use(new CustomersPage(page));
  },
});

export { expect };
