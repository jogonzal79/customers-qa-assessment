// Formato único de error para toda la API.
function sendError(res, httpStatus, code, message, details) {
  const error = { code, message };
  if (details && details.length) error.details = details;
  return res.status(httpStatus).json({ error });
}

module.exports = { sendError };
