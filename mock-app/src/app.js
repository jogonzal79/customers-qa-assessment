const path = require('path');
const express = require('express');
const defects = require('../defects.config');
const store = require('./store');
const customersRouter = require('./routes/customers');
const { mountDocs } = require('./docs');
const { sendError } = require('./errors');

function createApp() {
  const app = express();
  app.use(express.json());

  // Configuración que necesita el frontend (defecto d).
  app.get('/app-config.js', (req, res) => {
    res.type('application/javascript').send(
      `window.__DEFECTS__ = ${JSON.stringify({ uiIgnoresCreateResponse: defects.uiIgnoresCreateResponse })};`
    );
  });

  app.use('/customers', customersRouter);

  // Solo para testing: restaura los datos semilla. No forma parte del contrato.
  app.post('/__test/reset', (req, res) => {
    store.reset();
    res.status(204).end();
  });

  mountDocs(app);
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((req, res) => sendError(res, 404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return sendError(res, 400, 'MALFORMED_JSON', 'El body no es un JSON válido');
    }
    console.error(err);
    return sendError(res, 500, 'INTERNAL_ERROR', 'Error interno del servidor');
  });

  return app;
}

module.exports = { createApp };
