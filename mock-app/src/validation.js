const STATUSES = ['ACTIVE', 'PENDING', 'BLOCKED'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 100;
const EMAIL_MAX = 254;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function validateCreate(body) {
  const details = [];
  if (!isPlainObject(body)) {
    return [{ field: 'body', message: 'El body debe ser un objeto JSON' }];
  }
  const { name, email, status } = body;

  if (typeof name !== 'string' || name.trim() === '') {
    details.push({ field: 'name', message: 'name es obligatorio y debe ser un texto no vacío' });
  } else if (name.trim().length > NAME_MAX) {
    details.push({ field: 'name', message: `name no puede superar ${NAME_MAX} caracteres` });
  }

  if (typeof email !== 'string' || email.trim() === '') {
    details.push({ field: 'email', message: 'email es obligatorio' });
  } else if (email.trim().length > EMAIL_MAX || !EMAIL_RE.test(email.trim())) {
    details.push({ field: 'email', message: 'email no tiene un formato válido' });
  }

  if (status !== undefined && !STATUSES.includes(status)) {
    details.push({ field: 'status', message: `status debe ser uno de: ${STATUSES.join(', ')}` });
  }
  return details;
}

/**
 * @param {boolean} acceptLowercase  defecto (b): acepta "active" además de "ACTIVE"
 */
function validateStatusUpdate(body, { acceptLowercase }) {
  if (!isPlainObject(body)) {
    return [{ field: 'body', message: 'El body debe ser un objeto JSON' }];
  }
  const { status } = body;
  if (status === undefined) {
    return [{ field: 'status', message: 'status es obligatorio' }];
  }
  const valid =
    typeof status === 'string' &&
    (STATUSES.includes(status) || (acceptLowercase && STATUSES.includes(status.toUpperCase())));
  if (!valid) {
    return [{ field: 'status', message: `status debe ser uno de: ${STATUSES.join(', ')}` }];
  }
  return [];
}

// Devuelve el id como entero positivo, o null si no es válido.
function parseId(raw) {
  return /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
}

module.exports = { STATUSES, validateCreate, validateStatusUpdate, parseId };
