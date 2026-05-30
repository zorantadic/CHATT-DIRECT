const { app } = require("@azure/functions");
const { failResponse, serverTime } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const {
  readJsonBody,
  requireEmail,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");
const {
  createBaseRecord,
  getLicenseRecord,
  getLicenseTableClient,
  hashEmail,
  normalizeEmail,
  recordToResponseFields,
  resolveLicenseStatus,
  saveLicenseRecord,
} = require("../shared/storage");

app.http("licenseActivate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/license/activate",
  handler: async (request) => {
    const body = await readJsonBody(request);
    const email = requireEmail(body);
    if (!email.ok) return validationErrorResponse(email.message);

    const licenseKey = requireString(body, "licenseKey", "licenseKey");
    if (!licenseKey.ok) return validationErrorResponse(licenseKey.message);

    const installId = requireString(body, "installId", "installId");
    if (!installId.ok) return validationErrorResponse(installId.message);

    const { client, errorResponse } = getLicenseTableClient();
    if (!client) return errorResponse;

    const now = serverTime();
    const normalizedEmail = normalizeEmail(email.value);
    const emailHash = hashEmail(normalizedEmail);
    const deviceHash = String(body && body.deviceHash ? body.deviceHash : "").trim();
    try {
      const existing = await getLicenseRecord(client, installId.value);
      const record = existing || createBaseRecord(installId.value);
      record.registeredEmail = normalizedEmail;
      if (emailHash) record.emailHash = emailHash;
      if (deviceHash) record.deviceHash = deviceHash;
      record.licenseKeyLast4 = licenseKey.value.slice(-4);
      record.status = existing ? resolveLicenseStatus(existing, now) : LicenseStatuses.NOT_REGISTERED;
      record.updatedAt = now;
      await saveLicenseRecord(client, record);

      return failResponse(200, record.status, "Payment-backed license activation is not connected yet.", {
        ...recordToResponseFields(record),
      });
    } catch (err) {
      return failResponse(
        500,
        LicenseStatuses.ERROR,
        `License storage operation failed: ${err && err.message ? err.message : err}`
      );
    }
  },
});
