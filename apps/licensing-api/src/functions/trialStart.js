const { app } = require("@azure/functions");
const { failResponse } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const {
  readJsonBody,
  requireEmail,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");

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

    return failResponse(200, LicenseStatuses.NOT_REGISTERED, "Licensing storage is not connected yet.", {
      registeredEmail: email.value,
      installId: installId.value,
      trialStartedAt: null,
      trialExpiresAt: null,
      offlineGraceExpiresAt: null,
      checkoutUrl: null,
      paymentProvider: null,
    });
  },
});
