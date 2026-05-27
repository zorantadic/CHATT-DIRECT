# AnswerDesk AI Licensing API

This is the separate hosted/commercial licensing backend skeleton for AnswerDesk AI.

It is intentionally separate from `backend/app_realtime.py`. The local backend remains dedicated to Direct Realtime runtime behavior and should not contain commercial licensing logic.

## Current State

- Azure Functions Node.js v4 programming model.
- No persistence/storage is connected yet.
- Paddle and Lemon Squeezy are both still TBD payment candidates.
- Endpoints return deterministic skeleton responses so the Desktop licensing UI can integrate against a stable contract.
- `local.settings.json` must not be committed. Use `local.settings.example.json` as the local template.

## Endpoints

- `GET /v1/license/health`
- `POST /v1/license/trial/start`
- `POST /v1/license/validate`
- `POST /v1/license/activate`

Every endpoint returns `ok`, `status`, `message`, and `serverTime`.

## Validation

From this folder:

```powershell
npm install
node --check src/functions/health.js
node --check src/functions/trialStart.js
node --check src/functions/validate.js
node --check src/functions/activate.js
node --check src/shared/responses.js
node --check src/shared/licenseStatuses.js
node --check src/shared/validation.js
```

To run locally with Azure Functions Core Tools:

```powershell
npm start
```
