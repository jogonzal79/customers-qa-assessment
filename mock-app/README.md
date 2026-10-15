# Customers Mock App

Mock local de la app de clientes (API REST + frontend web) para el assessment de QA Automation.
Los datos viven en memoria y se pierden al reiniciar el servidor.

## Cómo arrancarlo

Requiere Node.js 18 o superior.

```bash
cd mock-app
npm install
npm start          # http://localhost:3000 (puerto configurable con la variable PORT)
```

| URL | Qué es |
|---|---|
| `http://localhost:3000/` | Frontend (alta, buscador y tabla de clientes) |
| `http://localhost:3000/docs` | Swagger UI |
| `http://localhost:3000/openapi.json` | Contrato publicado (el mismo spec que se ve en `/docs`) |

## Endpoints

| Método | Ruta | Éxito | Errores |
|---|---|---|---|
| POST | `/customers` | 201 + `Location` | 400 validación / JSON inválido, 409 email duplicado |
| GET | `/customers?search=` | 200 | — |
| GET | `/customers/{id}` | 200 | 400 id inválido, 404 no existe |
| PATCH | `/customers/{id}/status` | 200 | 400 status inválido o ausente, 404 no existe |

- Status válidos: `ACTIVE`, `PENDING`, `BLOCKED`. Si no se envía en el alta, queda en `PENDING`.
- Formato de error: `{ "error": { "code": "...", "message": "...", "details": [ { "field", "message" } ] } }`.
- Al arrancar se cargan 5 clientes semilla (ids 1 a 5).

### Endpoint solo para testing

`POST /__test/reset` responde **204** y restaura los datos semilla (ids 1 a 5, el contador de ids vuelve a 6).
Sirve para que cada prueba arranque desde el mismo estado. **No forma parte del contrato de la API** y
por eso no aparece en `/docs` ni en `/openapi.json`.

## Defectos sembrados

Se activan y desactivan en **`defects.config.js`** (`true` = defecto presente). Hay que reiniciar el servidor después de cambiarlos.
Todos vienen activados por defecto.

| Flag | Defecto | Cómo reproducirlo |
|---|---|---|
| `caseSensitiveEmailDuplicate` | (a) El duplicado de email solo se detecta si coincide exactamente. | `POST /customers` con `JUAN.PEREZ@example.com` → 201 (debería ser 409). |
| `acceptLowercaseStatus` | (b) PATCH acepta status en minúscula y los guarda tal cual. | `PATCH /customers/1/status` `{"status":"active"}` → 200 y se guarda `"active"` (debería ser 400). |
| `swaggerWrongCreateStatus` | (c) El contrato publicado dice que POST `/customers` responde 200; la API responde 201. | Comparar `/openapi.json` (o `/docs`) con la respuesta real del POST. |
| `uiIgnoresCreateResponse` | (d) El frontend muestra "Cliente creado correctamente" sin verificar la respuesta del POST. | Crear desde la UI un cliente con un email que ya existe: la API responde 409 y la UI muestra éxito. |

`openapi.yaml` es la fuente correcta del contrato (POST → 201). El defecto (c) se aplica al publicar el spec,
así que `/docs` y `/openapi.json` siempre muestran lo mismo.
