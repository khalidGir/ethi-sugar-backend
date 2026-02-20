# OpenAPI Specification – EthioSugar Backend (MVP)

Base URL: /api/v1

Authentication: Bearer JWT

---

## AUTH

POST /auth/login

Request:
{
"email": "user@email.com",
"password": "string"
}

Response:
{
"token": "jwt-token",
"user": {
"id": "uuid",
"fullName": "string",
"role": "ADMIN | SUPERVISOR | WORKER"
}
}

---

## FIELDS

POST /fields (ADMIN)

Request:
{
"name": "Field A",
"cropType": "Sugarcane",
"warningThreshold": 10,
"criticalThreshold": 15
}

GET /fields

Response:
[
{
"id": "uuid",
"name": "Field A",
"cropType": "Sugarcane",
"warningThreshold": 10,
"criticalThreshold": 15
}
]

---

## INCIDENTS

POST /incidents

Request:
{
"fieldId": "uuid",
"type": "CROP_DISEASE",
"severity": "HIGH",
"description": "Leaf infection spreading"
}

Response:
{
"id": "uuid",
"status": "OPEN",
"createdAt": "timestamp"
}

GET /incidents

Returns role-filtered incidents.

PATCH /incidents/:id/status

Request:
{
"status": "IN_PROGRESS | RESOLVED"
}

---

## IRRIGATION LOGS

POST /irrigation-logs

Request:
{
"fieldId": "uuid",
"moistureDeficit": 18
}

Response:
{
"status": "NORMAL | WARNING | CRITICAL"
}

---

## TASKS

GET /tasks

PATCH /tasks/:id/status

Request:
{
"status": "COMPLETED"
}

---

## INTERNAL

GET /internal/daily-summary
Header:
x-internal-token: INTERNAL_API_TOKEN

Response:
{
"totalIncidents": number,
"openIncidents": number,
"criticalFields": number,
"pendingTasks": number
}
