/** Clientes semilla que restaura POST /__test/reset. */
export const SEED = {
  count: 5,
  mariaGarcia: { id: 2, name: 'María García', email: 'maria.garcia@example.com' },
  anaMartinez: { id: 4, name: 'Ana Martínez', email: 'ana.martinez@example.com', status: 'BLOCKED' as const },
};

/** Email único por ejecución, para no depender del estado previo. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 10_000)}@example.com`;
}
