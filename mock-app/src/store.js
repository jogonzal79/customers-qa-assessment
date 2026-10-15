// Almacenamiento en memoria. Se pierde al reiniciar el servidor.

const SEED = [
  { name: 'Juan Pérez', email: 'juan.perez@example.com', status: 'ACTIVE', created_at: '2026-01-10T09:00:00.000Z' },
  { name: 'María García', email: 'maria.garcia@example.com', status: 'ACTIVE', created_at: '2026-02-14T11:30:00.000Z' },
  { name: 'Carlos López', email: 'carlos.lopez@example.com', status: 'PENDING', created_at: '2026-03-01T15:45:00.000Z' },
  { name: 'Ana Martínez', email: 'ana.martinez@example.com', status: 'BLOCKED', created_at: '2026-04-20T08:15:00.000Z' },
  { name: 'Luis Rodríguez', email: 'luis.rodriguez@example.com', status: 'PENDING', created_at: '2026-05-05T17:00:00.000Z' },
];

let customers = [];
let nextId = 1;

function reset() {
  customers = SEED.map((c, i) => ({ id: i + 1, ...c }));
  nextId = customers.length + 1;
}

function list(search) {
  if (!search) return [...customers];
  const term = search.toLowerCase();
  return customers.filter(
    (c) => c.name.toLowerCase().includes(term) || c.email.toLowerCase().includes(term)
  );
}

function findById(id) {
  return customers.find((c) => c.id === id);
}

function findByEmail(email, { caseSensitive }) {
  if (caseSensitive) return customers.find((c) => c.email === email);
  const target = email.toLowerCase();
  return customers.find((c) => c.email.toLowerCase() === target);
}

function create({ name, email, status }) {
  const customer = { id: nextId++, name, email, status, created_at: new Date().toISOString() };
  customers.push(customer);
  return customer;
}

function updateStatus(id, status) {
  const customer = findById(id);
  if (customer) customer.status = status;
  return customer;
}

reset();

module.exports = { reset, list, findById, findByEmail, create, updateStatus };
