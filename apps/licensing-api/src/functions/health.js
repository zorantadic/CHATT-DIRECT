const { app } = require("@azure/functions");
const { okResponse } = require("../shared/responses");

app.http("licenseHealth", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "v1/license/health",
  handler: async () => okResponse({
    status: "healthy",
    message: "Licensing API is running.",
  }),
});
