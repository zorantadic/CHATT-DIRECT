const { app } = require("@azure/functions");
const { failResponse } = require("../shared/responses");
const { LicenseStatuses } = require("../shared/licenseStatuses");
const {
  readJsonBody,
  requireEmail,
  requireString,
  validationErrorResponse,
} = require("../shared/validation");

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

    return failResponse(200, LicenseStatuses.NOT_REGISTERED, "Licensing storage is not connected yet.", {
      registeredEmail: email.value,
      installId: installId.value,
      licenseId: null,
      activationId: null,
      licenseKeyLast4: licenseKey.value.slice(-4),
      checkoutUrl: null,
      paymentProvider: null,
    });
  },
});
