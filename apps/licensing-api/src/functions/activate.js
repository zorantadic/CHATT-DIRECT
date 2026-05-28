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
    try {
      const existing = await getLicenseRecord(client, installId.value);
      const record = existing || createBaseRecord(installId.value);
      record.registeredEmail = email.value;
      record.licenseKeyLast4 = licenseKey.value.slice(-4);
      record.status = existing ? resolveLicenseStatus(existing, now) : LicenseStatuses.NOT_REGISTERED;
      record.updatedAt = now;
      await saveLicenseRecord(client, record);

      return failResponse(200, record.status, "Payment-backed license activation is not connected yet.", {
        registeredEmail: record.registeredEmail,
        installId: record.installId,
        trialStartedAt: record.trialStartedAt,
        trialExpiresAt: record.trialExpiresAt,
        licenseId: record.licenseId,
        activationId: record.activationId,
        licenseKeyLast4: record.licenseKeyLast4,
        licenseActivatedAt: record.licenseActivatedAt,
        lastValidatedAt: record.lastValidatedAt,
        offlineGraceExpiresAt: record.offlineGraceExpiresAt,
        checkoutUrl: record.checkoutUrl,
        paymentProvider: record.paymentProvider,
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
