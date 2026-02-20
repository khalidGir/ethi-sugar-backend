# EthioSugar Farm Automation – Backend Specification (MVP)

Version: 1.0  
Owner: Product Lead  
Scope: MVP (Frozen Scope)  
Audience: Backend Engineering Agent

---

# 1. SYSTEM OVERVIEW

## 1.1 Purpose

Build the backend API for the EthioSugar Farm Automation MVP.

The backend must:

- Handle authentication and role management
- Manage fields and irrigation thresholds
- Capture structured incidents
- Evaluate irrigation risk logic
- Trigger automation workflows via n8n
- Support AI summary integration
- Enforce strict role-based access
- Be production-deployable

---

# 2. TECHNICAL STACK (MANDATORY)

- Runtime: Node.js (LTS)
- Framework: Express.js
- Language: TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Authentication: JWT
- Validation: Zod
- Logging: Winston or Pino
- Deployment Target: Render
- Environment Management: dotenv

---

# 3. ARCHITECTURE STYLE

Modular domain-based architecture.

Structure:
src/
config/
modules/
auth/
users/
fields/
incidents/
irrigation/
tasks/
integrations/
n8n/
ai/
middlewares/
utils/
app.ts
server.ts

---

## 6.2 Irrigation Threshold Logic

When irrigation log is created:

Retrieve field thresholds.

Logic:

If moisture_deficit < warning_threshold:
status = NORMAL

If moisture_deficit >= warning_threshold
and < critical_threshold:
status = WARNING

If moisture_deficit >= critical_threshold:
status = CRITICAL
Create Task
Trigger n8n webhook

Escalation Rule:

If last 3 logs are WARNING:
escalate to CRITICAL

---

## 6.3 Daily Summary Endpoint

Create internal endpoint:

GET /internal/daily-summary

Returns:

- total incidents
- open incidents
- critical fields
- pending tasks

n8n will call this endpoint.

Protect with internal token.

---

# 7. API CONTRACT

## 7.1 AUTH

POST /auth/login  
POST /auth/register (Admin only)

---

## 7.2 USERS

GET /users (Admin only)  
PATCH /users/:id (Admin only)  
DELETE /users/:id (Admin only)

---

## 7.3 FIELDS

POST /fields (Admin)  
GET /fields (All authenticated)  
PATCH /fields/:id (Admin)

---

## 7.4 INCIDENTS

POST /incidents (Worker/Supervisor)  
GET /incidents (Role-filtered)  
PATCH /incidents/:id/status (Supervisor/Admin)

---

## 7.5 IRRIGATION

POST /irrigation-logs (Worker/Supervisor)  
GET /irrigation-logs?fieldId=

---

## 7.6 TASKS

GET /tasks  
PATCH /tasks/:id/status

---

# 8. ROLE ACCESS MATRIX

ADMIN:

- Full access

SUPERVISOR:

- View all fields
- Create/view incidents
- Update incident status
- View tasks

WORKER:

- Create incidents
- Create irrigation logs
- View assigned fields

---

# 9. SECURITY REQUIREMENTS

- JWT expiration: 24h
- Password hashing with bcrypt (min 10 rounds)
- Input validation required on all endpoints
- Rate limit login endpoint
- Helmet middleware enabled
- CORS restricted to frontend domain
- No sensitive data in logs

---

# 10. ERROR HANDLING

Standardized error format:
{
success: false,
message: "Error message",
code: "ERROR_CODE"
}

Global error handler required.

---

# 11. LOGGING REQUIREMENTS

Log:

- Authentication attempts
- Incident creation
- Irrigation critical events
- n8n webhook calls
- Errors

Do not log:

- Passwords
- JWT tokens

---

# 12. ENV VARIABLES

Required:

- DATABASE_URL
- JWT_SECRET
- N8N_WEBHOOK_INCIDENT
- N8N_WEBHOOK_IRRIGATION
- INTERNAL_API_TOKEN
- AI_API_KEY
- PORT

---

# 13. DEPLOYMENT REQUIREMENTS

- Production build using ts-node or compiled dist
- Health check endpoint:

GET /health

Response:
{
status: "ok"
}

- Must connect to managed PostgreSQL
- Render deployment ready

---

# 14. PERFORMANCE REQUIREMENTS

- Incident creation response time < 500ms
- Webhook call async (non-blocking)
- DB indexed on:
  - incidents.created_at
  - irrigation_logs.field_id
  - tasks.status

---

# 15. TESTING REQUIREMENTS

Minimum:

- Unit test irrigation threshold logic
- Unit test role guard middleware
- Test incident creation flow
- Test escalation rule

---

# 16. OUT OF SCOPE

- IoT sensor integration
- Predictive analytics
- Machine learning models
- Multi-AI orchestration
- Mobile app backend customization

---

# 17. DEFINITION OF DONE

Backend is complete when:

- All endpoints functional
- Role enforcement validated
- n8n webhook triggers working
- Irrigation logic validated
- Daily summary endpoint working
- Deployed successfully
- No critical security issues

---

END OF BACKEND SPECIFICATION
