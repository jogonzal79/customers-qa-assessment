const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');
const defects = require('../defects.config');

/**
 * Construye el contrato publicado. openapi.yaml es la fuente correcta (POST → 201);
 * si el defecto (c) está activo, el 201 se reemplaza por 200 antes de publicarlo.
 * /docs y /openapi.json usan este mismo objeto: hay un único contrato publicado.
 */
function buildPublishedSpec() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'openapi.yaml'), 'utf8');
  const spec = YAML.parse(raw);

  if (defects.swaggerWrongCreateStatus) {
    const responses = spec.paths['/customers'].post.responses;
    responses['200'] = { ...responses['201'], description: 'Cliente creado' };
    delete responses['201'];
    // Reordena para que 200 aparezca primero en Swagger UI.
    spec.paths['/customers'].post.responses = Object.fromEntries(
      Object.entries(responses).sort(([a], [b]) => a.localeCompare(b))
    );
  }
  return spec;
}

function mountDocs(app) {
  const spec = buildPublishedSpec();
  app.get('/openapi.json', (req, res) => res.json(spec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Customers API - Docs' }));
}

module.exports = { mountDocs, buildPublishedSpec };
