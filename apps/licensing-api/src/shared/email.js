const { EmailClient } = require("@azure/communication-email");

function isEmailEnabled() {
  return String(process.env.EMAIL_ENABLED || "").trim().toLowerCase() === "true";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEmailConfig() {
  return {
    enabled: isEmailEnabled(),
    connectionString: String(process.env.ACS_CONNECTION_STRING || "").trim(),
    fromAddress: String(process.env.ACS_EMAIL_FROM_ADDRESS || "").trim(),
    fromName: String(process.env.ACS_EMAIL_FROM_NAME || "").trim(),
  };
}

function buildTrialStartedMessage(record) {
  const trialExpiresAt = String(record && record.trialExpiresAt ? record.trialExpiresAt : "").trim();
  return {
    subject: "AnswerDesk AI trial started",
    plainText: [
      "Your 3-day AnswerDesk AI trial has started.",
      "",
      `Trial expires: ${trialExpiresAt || "Not provided"}`,
      "",
      "Thank you for trying AnswerDesk AI.",
    ].join("\n"),
    html: [
      "<html><body>",
      "<p>Your 3-day AnswerDesk AI trial has started.</p>",
      `<p>Trial expires: ${escapeHtml(trialExpiresAt || "Not provided")}</p>`,
      "<p>Thank you for trying AnswerDesk AI.</p>",
      "</body></html>",
    ].join(""),
  };
}

async function sendTrialStartedEmailBestEffort(record) {
  try {
    const toAddress = String(record && record.registeredEmail ? record.registeredEmail : "").trim();
    if (!toAddress) {
      return { ok: false, skipped: true, reason: "missing_to_address" };
    }

    const config = getEmailConfig();
    if (!config.enabled) {
      return { ok: false, skipped: true, reason: "email_disabled" };
    }
    if (!config.connectionString || !config.fromAddress) {
      console.warn("Trial started email not sent: ACS email configuration is incomplete.");
      return { ok: false, skipped: true, reason: "missing_configuration" };
    }

    const client = new EmailClient(config.connectionString);
    const message = buildTrialStartedMessage(record);
    const poller = await client.beginSend({
      senderAddress: config.fromAddress,
      content: {
        subject: message.subject,
        plainText: message.plainText,
        html: message.html,
      },
      recipients: {
        to: [{ address: toAddress, displayName: toAddress }],
      },
      senderDisplayName: config.fromName || undefined,
    });

    const result = await poller.pollUntilDone();
    return {
      ok: true,
      status: result && result.status ? result.status : "unknown",
    };
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.warn(`Trial started email send failed: ${message}`);
    return { ok: false, error: message };
  }
}

module.exports = {
  sendTrialStartedEmailBestEffort,
};
