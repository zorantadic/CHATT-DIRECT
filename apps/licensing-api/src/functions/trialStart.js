const { app } = require("@azure/functions");
const { failResponse, okResponse, serverTime } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const { sendTrialStartedEmailBestEffort } = require("../shared/email");
const {
  readJsonBody,
  requireEmail,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");
const {
  DEVICE_LOOKUP_PARTITION_KEY,
  EMAIL_LOOKUP_PARTITION_KEY,
  checkTrialStartRateLimit,
  createTrialRecord,
  getLicenseRecord,
  getRecordByLookup,
  getLicenseTableClient,
  normalizeEmail,
  hashEmail,
  recordToResponseFields,
  resolveLicenseStatus,
  saveLicenseRecord,
  saveLookupRecord,
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
    const normalizedEmail = normalizeEmail(email.value);
    const emailHash = hashEmail(normalizedEmail);
    const deviceHash = String(body && body.deviceHash ? body.deviceHash : "").trim();
    try {
      const rateLimit = await checkTrialStartRateLimit(client, emailHash, deviceHash, now);
      if (!rateLimit.allowed) {
        return failResponse(
          200,
          LicenseStatuses.RATE_LIMITED,
          "Too many trial attempts. Please try again later."
        );
      }

      let record = await getLicenseRecord(client, installId.value);
      if (!record && emailHash) {
        record = await getRecordByLookup(client, EMAIL_LOOKUP_PARTITION_KEY, emailHash);
      }
      if (!record && deviceHash) {
        record = await getRecordByLookup(client, DEVICE_LOOKUP_PARTITION_KEY, deviceHash);
      }

      if (!record) {
        record = createTrialRecord(installId.value, normalizedEmail, deviceHash, now);
        await saveLicenseRecord(client, record);
        await saveLookupRecord(client, EMAIL_LOOKUP_PARTITION_KEY, emailHash, record.installId, now);
        if (deviceHash) {
          await saveLookupRecord(client, DEVICE_LOOKUP_PARTITION_KEY, deviceHash, record.installId, now);
        }
        await sendTrialStartedEmailBestEffort(record);
        return okResponse({
          status: LicenseStatuses.TRIAL_ACTIVE,
          message: "Trial started.",
          ...recordToResponseFields(record),
        });
      }

      if (!record.registeredEmail) record.registeredEmail = normalizedEmail;
      if (!record.emailHash && emailHash) record.emailHash = emailHash;
      if (!record.deviceHash && deviceHash) record.deviceHash = deviceHash;
      record.status = resolveLicenseStatus(record, now);
      record.lastValidatedAt = now;
      record.updatedAt = now;
      await saveLicenseRecord(client, record);
      if (emailHash) {
        await saveLookupRecord(client, EMAIL_LOOKUP_PARTITION_KEY, emailHash, record.installId, now);
      }
      if (deviceHash) {
        await saveLookupRecord(client, DEVICE_LOOKUP_PARTITION_KEY, deviceHash, record.installId, now);
      }

      const isActive = record.status === LicenseStatuses.TRIAL_ACTIVE;
      const isLicensed = record.status === LicenseStatuses.LICENSED;
      const responseBody = {
        status: record.status,
        message: isLicensed ? "License is active." : isActive ? "Trial is active." : "Trial has expired.",
        ...recordToResponseFields(record),
      };
      return (isActive || isLicensed)
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
