const express = require('express');
const defects = require('../../defects.config');
const store = require('../store');
const { validateCreate, validateStatusUpdate, parseId } = require('../validation');
const { sendError } = require('../errors');

const router = express.Router();

router.post('/', (req, res) => {
  const details = validateCreate(req.body);
  if (details.length) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', details);
  }

  const name = req.body.name.trim();
  const email = req.body.email.trim();
  const status = req.body.status || 'PENDING';

  // Defecto (a): con el flag activo la comparación distingue mayúsculas/minúsculas.
  const existing = store.findByEmail(email, { caseSensitive: defects.caseSensitiveEmailDuplicate });
  if (existing) {
    return sendError(res, 409, 'EMAIL_ALREADY_EXISTS', `Ya existe un cliente con el email ${email}`);
  }

  const customer = store.create({ name, email, status });
  res.status(201).location(`/customers/${customer.id}`).json(customer);
});

router.get('/', (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  res.json(store.list(search));
});

router.get('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendError(res, 400, 'INVALID_ID', 'El id debe ser un entero positivo');
  }
  const customer = store.findById(id);
  if (!customer) {
    return sendError(res, 404, 'CUSTOMER_NOT_FOUND', `No existe el cliente con id ${id}`);
  }
  res.json(customer);
});

router.patch('/:id/status', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return sendError(res, 400, 'INVALID_ID', 'El id debe ser un entero positivo');
  }
  if (!store.findById(id)) {
    return sendError(res, 404, 'CUSTOMER_NOT_FOUND', `No existe el cliente con id ${id}`);
  }
  // Defecto (b): con el flag activo "active" pasa la validación y se guarda tal cual.
  const details = validateStatusUpdate(req.body, { acceptLowercase: defects.acceptLowercaseStatus });
  if (details.length) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Datos de entrada inválidos', details);
  }
  res.json(store.updateStatus(id, req.body.status));
});

module.exports = router;
