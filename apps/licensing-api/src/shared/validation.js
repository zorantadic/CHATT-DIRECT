const { failResponse } = require("./responses");
const { LicenseStatuses } = require("./licenseStatuses");

async function readJsonBody(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : {};
  } catch (_) {
    return {};
  }
}

function stringValue(value) {
  return value == null ? "" : String(value).trim();
}

function optionalString(payload, field) {
  return stringValue(payload && payload[field]);
}

function requireString(payload, field, label) {
  const value = optionalString(payload, field);
  if (!value) {
    return {
      ok: false,
      message: `${label || field} is required.`,
    };
  }
  return { ok: true, value };
}

function requireEmail(payload) {
  const value = optionalString(payload, "email");
  if (!value || !value.includes("@")) {
    return {
      ok: false,
      message: "A valid email address is required.",
    };
  }
  return { ok: true, value };
}

function validationErrorResponse(message) {
  return failResponse(400, LicenseStatuses.ERROR, message || "Invalid request.");
}

module.exports = {
  readJsonBody,
  stringValue,
  optionalString,
  requireString,
  requireEmail,
  validationErrorResponse,
};
