function serverTime() {
  return new Date().toISOString();
}

function withServerTime(body) {
  return {
    ...(body || {}),
    serverTime: body && body.serverTime ? body.serverTime : serverTime(),
  };
}

function jsonResponse(statusCode, body) {
  return {
    status: statusCode,
    jsonBody: withServerTime(body),
  };
}

function okResponse(body) {
  return jsonResponse(200, {
    ok: true,
    ...(body || {}),
  });
}

function failResponse(statusCode, status, message, extra) {
  return jsonResponse(statusCode, {
    ok: false,
    status,
    message,
    ...(extra || {}),
  });
}

module.exports = {
  serverTime,
  withServerTime,
  jsonResponse,
  okResponse,
  failResponse,
};
