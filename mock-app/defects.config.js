/**
 * Defectos sembrados a propósito para el assessment.
 *
 * Este es el ÚNICO lugar donde se activan/desactivan.
 *   true  → el defecto está presente (comportamiento con bug)
 *   false → comportamiento correcto
 *
 * Reinicia el servidor (npm start) después de cambiar un valor.
 */
module.exports = {
  // (a) El duplicado de email solo se detecta con coincidencia exacta:
  //     "Juan@x.com" y "juan@x.com" se aceptan como clientes distintos.
  caseSensitiveEmailDuplicate: true,

  // (b) PATCH /customers/{id}/status acepta status en minúscula ("active")
  //     y los guarda tal cual, sin normalizar ni rechazar.
  acceptLowercaseStatus: true,

  // (c) El contrato publicado (/docs y /openapi.json) dice que
  //     POST /customers responde 200, pero la API responde 201.
  swaggerWrongCreateStatus: true,

  // (d) El frontend muestra "Cliente creado correctamente" sin verificar
  //     que la respuesta del POST haya sido exitosa.
  uiIgnoresCreateResponse: true,
};
