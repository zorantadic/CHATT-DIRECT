const { app } = require("@azure/functions");
const { failResponse, okResponse, serverTime } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const {
  readJsonBody,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");
const {
  getLicenseRecord,
  getLicenseTableClient,
  recordToResponseFields,
  resolveLicenseStatus,
  saveLicenseRecord,
} = require("../shared/storage");

app.http("licenseValidate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/license/validate",
  handler: async (request) => {
    const body = await readJsonBody(request);
    const installId = requireString(body, "installId", "installId");
    if (!installId.ok) return validationErrorResponse(installId.message);

    const { client, errorResponse } = getLicenseTableClient();
    if (!client) return errorResponse;

    const now = serverTime();
    try {
      const record = await getLicenseRecord(client, installId.value);
      if (!record) {
        return failResponse(200, LicenseStatuses.NOT_REGISTERED, "No license or trial record exists for this install.", {
          installId: installId.value,
          licenseId: null,
          activationId: null,
          offlineGraceExpiresAt: null,
          checkoutUrl: null,
          paymentProvider: null,
        });
      }

      record.status = resolveLicenseStatus(record, now);
      record.lastValidatedAt = now;
      record.updatedAt = now;
      await saveLicenseRecord(client, record);

      const ok = record.status === LicenseStatuses.TRIAL_ACTIVE || record.status === LicenseStatuses.LICENSED;
      const message =
        record.status === LicenseStatuses.LICENSED
          ? "License is active."
          : record.status === LicenseStatuses.TRIAL_ACTIVE
            ? "Trial is active."
            : record.status === LicenseStatuses.TRIAL_EXPIRED
              ? "Trial has expired."
              : "No active license or trial record exists for this install.";

      if (ok) {
        return okResponse({
          status: record.status,
          message,
          ...recordToResponseFields(record),
        });
      }

      return failResponse(200, record.status, message, {
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
