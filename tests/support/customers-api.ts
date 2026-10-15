import { APIRequestContext, expect } from '@playwright/test';

export type CustomerStatus = 'ACTIVE' | 'PENDING' | 'BLOCKED';

export interface Customer {
  id: number;
  name: string;
  email: string;
  status: CustomerStatus;
  created_at: string;
}

/** Acceso directo a la API para preparar y verificar estado desde los tests. */
export class CustomersApi {
  constructor(private readonly request: APIRequestContext) {}

  /** Restaura los 5 clientes semilla (endpoint de soporte de pruebas). */
  async reset(): Promise<void> {
    const response = await this.request.post('/__test/reset');
    expect(response.status(), 'POST /__test/reset').toBe(204);
  }

  async getCustomer(id: number): Promise<Customer> {
    const response = await this.request.get(`/customers/${id}`);
    expect(response.status(), `GET /customers/${id}`).toBe(200);
    return response.json();
  }

  async updateStatus(id: number, status: CustomerStatus): Promise<Customer> {
    const response = await this.request.patch(`/customers/${id}/status`, { data: { status } });
    expect(response.status(), `PATCH /customers/${id}/status`).toBe(200);
    return response.json();
  }
}
