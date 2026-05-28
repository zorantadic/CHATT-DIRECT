const { app } = require("@azure/functions");
const { failResponse, okResponse, serverTime } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const {
  readJsonBody,
  requireEmail,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");
const {
  addTrialDuration,
  createBaseRecord,
  getLicenseRecord,
  getLicenseTableClient,
  resolveLicenseStatus,
  saveLicenseRecord,
} = require("../shared/storage");

app.http("licenseTrialStart", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/license/trial/start",
  handler: async (request) => {
    const body = await readJsonBody(request);
    const email = requireEmail(body);
    if (!email.ok) return validationErrorResponse(email.message);

    const installId = requireString(body, "installId", "installId");
    if (!installId.ok) return validationErrorResponse(installId.message);

    const { client, errorResponse } = getLicenseTableClient();
    if (!client) return errorResponse;

    const now = serverTime();
    try {
      let record = await getLicenseRecord(client, installId.value);
      if (!record) {
        record = createBaseRecord(installId.value);
        record.registeredEmail = email.value;
        record.status = LicenseStatuses.TRIAL_ACTIVE;
        record.trialStartedAt = now;
        record.trialExpiresAt = addTrialDuration(now);
        record.lastValidatedAt = now;
        record.updatedAt = now;
        await saveLicenseRecord(client, record);
        return okResponse({
          status: LicenseStatuses.TRIAL_ACTIVE,
          message: "Trial started.",
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
      }

      record.registeredEmail = email.value;
      record.status = resolveLicenseStatus(record, now);
      record.lastValidatedAt = now;
      record.updatedAt = now;
      await saveLicenseRecord(client, record);

      const isActive = record.status === LicenseStatuses.TRIAL_ACTIVE;
      const responseBody = {
        status: record.status,
        message: isActive ? "Trial is active." : "Trial has expired.",
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
      };
      return isActive
        ? okResponse(responseBody)
        : failResponse(200, record.status, responseBody.message, responseBody);
    } catch (err) {
      return failResponse(
        500,
        LicenseStatuses.ERROR,
        `License storage operation failed: ${err && err.message ? err.message : err}`
      );
    }
  },
});
