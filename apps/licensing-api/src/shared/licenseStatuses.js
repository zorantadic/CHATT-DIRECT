const LicenseStatuses = Object.freeze({
  NOT_REGISTERED: "not_registered",
  TRIAL_ACTIVE: "trial_active",
  TRIAL_EXPIRED: "trial_expired",
  LICENSED: "licensed",
  LICENSE_INVALID: "license_invalid",
  LICENSE_REVOKED: "license_revoked",
  OFFLINE_GRACE: "offline_grace",
  ERROR: "error",
});

const LICENSE_STATUS_VALUES = Object.freeze(Object.values(LicenseStatuses));

module.exports = {
  LicenseStatuses,
  LICENSE_STATUS_VALUES,
};
