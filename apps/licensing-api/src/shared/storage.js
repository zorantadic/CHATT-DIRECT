const crypto = require("crypto");
const { TableClient } = require("@azure/data-tables");
const { failResponse, serverTime } = require("./responses");
const { LicenseStatuses } = require("./licenseStatuses");

const LICENSE_PARTITION_KEY = "license";
const EMAIL_LOOKUP_PARTITION_KEY = "email";
const DEVICE_LOOKUP_PARTITION_KEY = "device";
const RATE_LIMIT_PARTITION_KEY = "rate";
const LICENSE_TABLE_NAME = process.env.LICENSE_TABLE_NAME || "LicenseRecords";
const TRIAL_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const TRIAL_START_RATE_LIMIT_MAX = 10;
const TRIAL_START_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function isoAt(timestamp) {
  return new Date(timestamp).toISOString();
}

function addTrialDuration(isoString) {
  return isoAt(Date.parse(isoString) + TRIAL_DURATION_MS);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashEmail(email) {
  const normalized = normalizeEmail(email);
  return normalized ? sha256Hex(normalized) : "";
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
    emailHash: entity.emailHash || null,
    deviceHash: entity.deviceHash || null,
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
    emailHash: null,
    deviceHash: null,
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

function createTrialRecord(installId, email, deviceHash, now) {
  const normalizedEmail = normalizeEmail(email);
  const record = createBaseRecord(installId);
  record.registeredEmail = normalizedEmail || null;
  record.emailHash = normalizedEmail ? hashEmail(normalizedEmail) : null;
  record.deviceHash = String(deviceHash || "").trim() || null;
  record.status = LicenseStatuses.TRIAL_ACTIVE;
  record.trialStartedAt = now;
  record.trialExpiresAt = addTrialDuration(now);
  record.lastValidatedAt = now;
  record.createdAt = now;
  record.updatedAt = now;
  return record;
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
    emailHash: record.emailHash || null,
    deviceHash: record.deviceHash || null,
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

function recordToResponseFields(record) {
  return {
    registeredEmail: record ? record.registeredEmail : null,
    installId: record ? record.installId : null,
    trialStartedAt: record ? record.trialStartedAt : null,
    trialExpiresAt: record ? record.trialExpiresAt : null,
    licenseId: record ? record.licenseId : null,
    activationId: record ? record.activationId : null,
    licenseKeyLast4: record ? record.licenseKeyLast4 : null,
    licenseActivatedAt: record ? record.licenseActivatedAt : null,
    lastValidatedAt: record ? record.lastValidatedAt : null,
    offlineGraceExpiresAt: record ? record.offlineGraceExpiresAt : null,
    checkoutUrl: record ? record.checkoutUrl : null,
    paymentProvider: record ? record.paymentProvider : null,
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

async function getLookupRecord(client, partitionKey, rowKey) {
  const normalizedRowKey = String(rowKey || "").trim();
  if (!normalizedRowKey) return null;
  try {
    return await client.getEntity(partitionKey, normalizedRowKey);
  } catch (err) {
    if (err && err.statusCode === 404) return null;
    throw err;
  }
}

async function saveLookupRecord(client, partitionKey, rowKey, installId, now) {
  const normalizedRowKey = String(rowKey || "").trim();
  if (!normalizedRowKey) return null;
  const existing = await getLookupRecord(client, partitionKey, normalizedRowKey);
  const entity = {
    partitionKey,
    rowKey: normalizedRowKey,
    installId,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now,
  };
  await client.upsertEntity(entity, "Merge");
  return entity;
}

async function getRecordByLookup(client, partitionKey, rowKey) {
  const lookup = await getLookupRecord(client, partitionKey, rowKey);
  if (!lookup || !lookup.installId) return null;
  return getLicenseRecord(client, lookup.installId);
}

async function getRateLimitRecord(client, rowKey) {
  return getLookupRecord(client, RATE_LIMIT_PARTITION_KEY, rowKey);
}

async function checkAndIncrementRateLimit(client, rowKey, now) {
  const normalizedRowKey = String(rowKey || "").trim();
  if (!normalizedRowKey) return { allowed: true };

  const existing = await getRateLimitRecord(client, normalizedRowKey);
  const nowMs = Date.parse(now);

  if (!existing) {
    await client.upsertEntity({
      partitionKey: RATE_LIMIT_PARTITION_KEY,
      rowKey: normalizedRowKey,
      count: 1,
      windowStartedAt: now,
      updatedAt: now,
    }, "Merge");
    return { allowed: true };
  }

  const windowStartedAt = existing.windowStartedAt || now;
  const windowMs = Date.parse(windowStartedAt);
  const windowExpired = !Number.isFinite(windowMs) || (nowMs - windowMs) >= TRIAL_START_RATE_LIMIT_WINDOW_MS;
  const currentCount = Number(existing.count) || 0;

  if (windowExpired) {
    await client.upsertEntity({
      partitionKey: RATE_LIMIT_PARTITION_KEY,
      rowKey: normalizedRowKey,
      count: 1,
      windowStartedAt: now,
      updatedAt: now,
    }, "Merge");
    return { allowed: true };
  }

  if (currentCount >= TRIAL_START_RATE_LIMIT_MAX) {
    await client.upsertEntity({
      partitionKey: RATE_LIMIT_PARTITION_KEY,
      rowKey: normalizedRowKey,
      count: currentCount,
      windowStartedAt,
      updatedAt: now,
    }, "Merge");
    return {
      allowed: false,
      status: LicenseStatuses.RATE_LIMITED,
      message: "Too many trial attempts. Please try again later.",
    };
  }

  await client.upsertEntity({
    partitionKey: RATE_LIMIT_PARTITION_KEY,
    rowKey: normalizedRowKey,
    count: currentCount + 1,
    windowStartedAt,
    updatedAt: now,
  }, "Merge");
  return { allowed: true };
}

async function checkTrialStartRateLimit(client, emailHash, deviceHash, now) {
  const emailKey = emailHash ? `trialStart:email:${emailHash}` : "";
  const emailResult = await checkAndIncrementRateLimit(client, emailKey, now);
  if (!emailResult.allowed) return emailResult;

  const deviceKey = deviceHash ? `trialStart:device:${deviceHash}` : "";
  const deviceResult = await checkAndIncrementRateLimit(client, deviceKey, now);
  if (!deviceResult.allowed) return deviceResult;

  return { allowed: true };
}

module.exports = {
  LICENSE_PARTITION_KEY,
  EMAIL_LOOKUP_PARTITION_KEY,
  DEVICE_LOOKUP_PARTITION_KEY,
  RATE_LIMIT_PARTITION_KEY,
  LICENSE_TABLE_NAME,
  TRIAL_DURATION_MS,
  TRIAL_START_RATE_LIMIT_MAX,
  TRIAL_START_RATE_LIMIT_WINDOW_MS,
  isoAt,
  addTrialDuration,
  sha256Hex,
  normalizeEmail,
  hashEmail,
  getLicenseTableClient,
  createBaseRecord,
  createTrialRecord,
  resolveLicenseStatus,
  recordToResponseFields,
  getLicenseRecord,
  saveLicenseRecord,
  getLookupRecord,
  saveLookupRecord,
  getRecordByLookup,
  getRateLimitRecord,
  checkAndIncrementRateLimit,
  checkTrialStartRateLimit,
};
