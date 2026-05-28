const { TableClient } = require("@azure/data-tables");
const { failResponse, serverTime } = require("./responses");
const { LicenseStatuses } = require("./licenseStatuses");

const LICENSE_PARTITION_KEY = "license";
const LICENSE_TABLE_NAME = process.env.LICENSE_TABLE_NAME || "LicenseRecords";
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;

function isoAt(timestamp) {
  return new Date(timestamp).toISOString();
}

function addTrialDuration(isoString) {
  return isoAt(Date.parse(isoString) + TRIAL_DURATION_MS);
}

function getLicenseTableClient() {
  const connectionString = (process.env.LICENSE_STORAGE_CONNECTION_STRING || "").trim();
  if (!connectionString) {
    return {
      client: null,
      errorResponse: failResponse(
        500,
        LicenseStatuses.ERROR,
        "LICENSE_STORAGE_CONNECTION_STRING is not configured."
      ),
    };
  }

  try {
    return {
      client: TableClient.fromConnectionString(connectionString, LICENSE_TABLE_NAME),
      errorResponse: null,
    };
  } catch (err) {
    return {
      client: null,
      errorResponse: failResponse(
        500,
        LicenseStatuses.ERROR,
        `License storage client initialization failed: ${err && err.message ? err.message : err}`
      ),
    };
  }
}

function toRecord(entity) {
  if (!entity) return null;
  return {
    installId: entity.rowKey || entity.RowKey || null,
    registeredEmail: entity.registeredEmail || null,
    status: entity.status || LicenseStatuses.NOT_REGISTERED,
    trialStartedAt: entity.trialStartedAt || null,
    trialExpiresAt: entity.trialExpiresAt || null,
    licenseId: entity.licenseId || null,
    activationId: entity.activationId || null,
    licenseKeyLast4: entity.licenseKeyLast4 || null,
    licenseActivatedAt: entity.licenseActivatedAt || null,
    lastValidatedAt: entity.lastValidatedAt || null,
    offlineGraceExpiresAt: entity.offlineGraceExpiresAt || null,
    checkoutUrl: entity.checkoutUrl || null,
    paymentProvider: entity.paymentProvider || null,
    createdAt: entity.createdAt || null,
    updatedAt: entity.updatedAt || null,
  };
}

function createBaseRecord(installId) {
  const now = serverTime();
  return {
    installId,
    registeredEmail: null,
    status: LicenseStatuses.NOT_REGISTERED,
    trialStartedAt: null,
    trialExpiresAt: null,
    licenseId: null,
    activationId: null,
    licenseKeyLast4: null,
    licenseActivatedAt: null,
    lastValidatedAt: null,
    offlineGraceExpiresAt: null,
    checkoutUrl: null,
    paymentProvider: null,
    createdAt: now,
    updatedAt: now,
  };
}

function resolveLicenseStatus(record, now = serverTime()) {
  if (!record) return LicenseStatuses.NOT_REGISTERED;
  if (record.status === LicenseStatuses.LICENSED) return LicenseStatuses.LICENSED;

  const trialExpiresAt = record.trialExpiresAt || null;
  if (trialExpiresAt) {
    return Date.parse(now) < Date.parse(trialExpiresAt)
      ? LicenseStatuses.TRIAL_ACTIVE
      : LicenseStatuses.TRIAL_EXPIRED;
  }

  return record.status || LicenseStatuses.NOT_REGISTERED;
}

function toEntity(record) {
  return {
    partitionKey: LICENSE_PARTITION_KEY,
    rowKey: record.installId,
    installId: record.installId,
    registeredEmail: record.registeredEmail || null,
    status: record.status || LicenseStatuses.NOT_REGISTERED,
    trialStartedAt: record.trialStartedAt || null,
    trialExpiresAt: record.trialExpiresAt || null,
    licenseId: record.licenseId || null,
    activationId: record.activationId || null,
    licenseKeyLast4: record.licenseKeyLast4 || null,
    licenseActivatedAt: record.licenseActivatedAt || null,
    lastValidatedAt: record.lastValidatedAt || null,
    offlineGraceExpiresAt: record.offlineGraceExpiresAt || null,
    checkoutUrl: record.checkoutUrl || null,
    paymentProvider: record.paymentProvider || null,
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
  };
}

async function getLicenseRecord(client, installId) {
  try {
    const entity = await client.getEntity(LICENSE_PARTITION_KEY, installId);
    return toRecord(entity);
  } catch (err) {
    if (err && err.statusCode === 404) return null;
    throw err;
  }
}

async function saveLicenseRecord(client, record) {
  const entity = toEntity(record);
  await client.upsertEntity(entity, "Merge");
  return record;
}

module.exports = {
  LICENSE_PARTITION_KEY,
  LICENSE_TABLE_NAME,
  TRIAL_DURATION_MS,
  isoAt,
  addTrialDuration,
  getLicenseTableClient,
  createBaseRecord,
  resolveLicenseStatus,
  getLicenseRecord,
  saveLicenseRecord,
};
