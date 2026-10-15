# Comandos cURL equivalentes

Reproducen, en el mismo orden, los requests de `customers-api.postman_collection.json`.

- Shell: **Bash** (Git Bash en Windows, o Linux/macOS). Ejecutar desde la **raíz del repo**.
- Los bodies se envían desde archivos UTF-8 de `postman/bodies/` con `--data-binary @archivo`. Así se evita que Git Bash
  en Windows envíe los caracteres con tilde en la codificación local (por ejemplo, `Automatización` llegaría como `Automatizaci�n`).
- Los bodies que dependen del email dinámico tienen el marcador `__EMAIL__`. `sed` lo reemplaza y pasa el resultado a
  curl por la entrada estándar (`--data-binary @-`), sin alterar los bytes UTF-8 del resto del archivo.
- Para extraer valores de las respuestas se usa `node`, que ya es requisito del proyecto.

## 0. Variables

```bash
BASE_URL="http://localhost:3000"
EMAIL="qa.auto.$(date +%s).$RANDOM@example.com"
EMAIL_UPPER=$(printf '%s' "$EMAIL" | tr '[:lower:]' '[:upper:]')
OUT=$(mktemp -d)              # respuestas guardadas para encadenar valores
JSON="Content-Type: application/json; charset=utf-8"
```

## 01 — Crear cliente válido [TC-01]

Esperado: **201 Created**, header `Location: /customers/{id}`.

```bash
sed "s/__EMAIL__/$EMAIL/" postman/bodies/01-create-valid.json \
  | curl -s -i -X POST "$BASE_URL/customers" -H "$JSON" --data-binary @- \
  | tee "$OUT/01.txt"; echo

# Se guardan el id y el código obtenido para los pasos siguientes
CUSTOMER_ID=$(tail -n 1 "$OUT/01.txt" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).id")
CREATE_STATUS=$(head -n 1 "$OUT/01.txt" | awk '{print $2}')
echo "CUSTOMER_ID=$CUSTOMER_ID CREATE_STATUS=$CREATE_STATUS"
```

## 02 — Crear cliente con email inválido [TC-06]

Esperado: **400 Bad Request**, `VALIDATION_ERROR` con `details[].field = "email"` en cada request.

```bash
for f in 02a-invalid-email-no-at 02b-invalid-email-no-domain 02c-invalid-email-no-tld 02d-invalid-email-space; do
  echo "--- $f"
  curl -s -i -X POST "$BASE_URL/customers" -H "$JSON" --data-binary @"postman/bodies/$f.json"; echo
done
```

## 03 — Crear cliente con email duplicado [TC-08]

Esperado: **409 Conflict**, `EMAIL_ALREADY_EXISTS`.

```bash
sed "s/__EMAIL__/$EMAIL/" postman/bodies/03-duplicate-email.json \
  | curl -s -i -X POST "$BASE_URL/customers" -H "$JSON" --data-binary @-; echo
```

## 04 — Obtener cliente existente [TC-04]

Esperado: **200 OK** con el cliente creado en el paso 01.

```bash
curl -s -i "$BASE_URL/customers/$CUSTOMER_ID"; echo
```

## 05 — Consultar cliente inexistente [TC-10]

Esperado: **404 Not Found** (`CUSTOMER_NOT_FOUND`) y **400 Bad Request** (`INVALID_ID`).

```bash
curl -s -i "$BASE_URL/customers/999999999"; echo
curl -s -i "$BASE_URL/customers/abc"; echo
```

## 06 — Actualizar status válido [TC-05]

Esperado: **200 OK** con `status: "BLOCKED"`; el GET posterior confirma que el cambio se guardó.

```bash
curl -s -i -X PATCH "$BASE_URL/customers/$CUSTOMER_ID/status" -H "$JSON" \
  --data-binary @postman/bodies/06-status-blocked.json; echo
curl -s -i "$BASE_URL/customers/$CUSTOMER_ID"; echo
```

## 07 — Actualizar status inválido [TC-11]

Esperado: **400 Bad Request**, `VALIDATION_ERROR` con `details[].field = "status"`; el GET posterior sigue mostrando `BLOCKED`.

```bash
curl -s -i -X PATCH "$BASE_URL/customers/$CUSTOMER_ID/status" -H "$JSON" \
  --data-binary @postman/bodies/07-status-invalid.json; echo
curl -s -i "$BASE_URL/customers/$CUSTOMER_ID"; echo
```

## R1 — Email duplicado con otras mayúsculas [TC-09]

Esperado: **409 Conflict**, `EMAIL_ALREADY_EXISTS`.

```bash
sed "s/__EMAIL__/$EMAIL_UPPER/" postman/bodies/r1-duplicate-email-uppercase.json \
  | curl -s -i -X POST "$BASE_URL/customers" -H "$JSON" --data-binary @-; echo
```

## R2 — Status en minúscula [TC-12]

Esperado: **400 Bad Request**, `VALIDATION_ERROR`; el GET posterior sigue mostrando `BLOCKED`.

```bash
curl -s -i -X PATCH "$BASE_URL/customers/$CUSTOMER_ID/status" -H "$JSON" \
  --data-binary @postman/bodies/r2-status-lowercase.json; echo
curl -s -i "$BASE_URL/customers/$CUSTOMER_ID"; echo
```

## R3 — Contrato: código del alta documentado vs. real [TC-14]

Esperado: el código 2xx documentado para `POST /customers` coincide con el obtenido en el paso 01 (`$CREATE_STATUS`).

```bash
DOCUMENTED=$(curl -s "$BASE_URL/openapi.json" | node -pe "
  Object.keys(JSON.parse(require('fs').readFileSync(0,'utf8')).paths['/customers'].post.responses)
    .filter(c => /^2\d\d$/.test(c)).join(',')")
echo "Documentado: $DOCUMENTED | Real: $CREATE_STATUS"
[ "$DOCUMENTED" = "$CREATE_STATUS" ] && echo "PASS" || echo "FAIL"
```
