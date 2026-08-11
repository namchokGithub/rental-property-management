function sendSuccess(response, data, statusCode = 200) {
  return response.status(statusCode).json({ success: true, data });
}

function sendList(response, data, meta = {}) {
  return response.status(200).json({
    success: true,
    data,
    meta: { total: data.length, ...meta },
  });
}

function sendError(response, statusCode, code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;

  return response.status(statusCode).json({ success: false, error });
}

module.exports = { sendSuccess, sendList, sendError };
