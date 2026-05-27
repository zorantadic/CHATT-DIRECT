const { app } = require("@azure/functions");
const { failResponse } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const {
  readJsonBody,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");

app.http("licenseValidate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "v1/license/validate",
  handler: async (request) => {
    const body = await readJsonBody(request);
    const installId = requireString(body, "installId", "installId");
    if (!installId.ok) return validationErrorResponse(installId.message);

    return failResponse(200, LicenseStatuses.NOT_REGISTERED, "Licensing storage is not connected yet.", {
      installId: installId.value,
      licenseId: null,
      activationId: null,
      offlineGraceExpiresAt: null,
      checkoutUrl: null,
      paymentProvider: null,
    });
  },
});
