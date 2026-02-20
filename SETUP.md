# EthioSugar Backend - Setup Guide

## Table of Contents
1. [GitHub Repository](#github-repository)
2. [Render Deployment](#render-deployment)
3. [n8n Cloud Setup](#n8n-cloud-setup)
4. [Configuration](#configuration)

---

## GitHub Repository

Repository URL: https://github.com/khalidGir/ethi-sugar-backend.git

The backend has been pushed to GitHub and is ready for deployment.

---

## Render Deployment

### Option 1: Automatic Deployment (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" and select "Web Service"
3. Connect your GitHub account
4. Select the `ethi-sugar-backend` repository
5. Configure:
   - **Name:** ethiosugar-backend
   - **Environment:** Node
   - **Build Command:** `npm install && npx prisma generate && npm run build`
   - **Start Command:** `npm start`
6. Add Environment Variables:
   - `DATABASE_URL`: `postgresql://ethio_sugar_db_user:HNfAEVBIhWzEsBQ828ezyDbuTrg9nD2l@dpg-d6bmt3rh46gs73br97r0-a.oregon-postgres.render.com/ethio_sugar_db`
   - `JWT_SECRET`: Your secure JWT secret
   - `N8N_WEBHOOK_INCIDENT`: (Will be provided after n8n setup)
   - `N8N_WEBHOOK_IRRIGATION`: (Will be provided after n8n setup)
   - `INTERNAL_API_TOKEN`: Your internal API token
   - `AI_API_KEY`: (Optional) Your AI API key
   - `NODE_ENV`: `production`
   - `PORT`: `3000`
   - `CORS_ORIGIN`: `*` (or your frontend domain)
7. Click "Create Web Service"

### Option 2: Using render.yaml

The repository includes `render.yaml` for automatic deployment. Simply connect your GitHub repo to Render and it will auto-detect the configuration.

---

## n8n Cloud Setup

### Step 1: Create n8n Cloud Account

1. Go to https://n8n.io/
2. Click "Start for free"
3. Sign up with GitHub or email
4. You'll be redirected to your n8n workspace

### Step 2: Create Incident Webhook Workflow

1. In n8n, click "Add Workflow"
2. Click the "+" to add a node
3. Search for "Webhook" and select it
4. Set HTTP Method: **POST**
5. Copy the Webhook URL (you'll need this for your `.env`)
6. Connect the Webhook node to whatever actions you want (Slack, Email, etc.)
7. Click "Save" and "Active" toggle

### Step 3: Create Irrigation Webhook Workflow

1. Repeat the same steps as above
2. This webhook handles critical irrigation alerts
3. Copy this URL as well

### Step 4: Update Environment Variables

After creating your webhooks, update your `.env` file:

```bash
N8N_WEBHOOK_INCIDENT=https://your-n8n-instance/webhook/incident
N8N_WEBHOOK_IRRIGATION=https://your-n8n-instance/webhook/irrigation
```

If using Render, update these in the Render dashboard.

---

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | (Render provides this) |
| JWT_SECRET | Secret key for JWT tokens | Generate a secure random string |
| N8N_WEBHOOK_INCIDENT | Webhook URL for incidents | https://n8n.io/webhook/xxx |
| N8N_WEBHOOK_IRRIGATION | Webhook URL for irrigation | https://n8n.io/webhook/yyy |
| INTERNAL_API_TOKEN | Token for internal endpoints | Generate a secure random string |
| AI_API_KEY | Optional AI service key | (Optional) |
| NODE_ENV | Environment | production |
| PORT | Server port | 3000 |
| CORS_ORIGIN | Allowed origins | * or your frontend URL |

### Seed Data

The database is seeded with test users:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@ethiosugar.local | Admin123! |
| Supervisor | supervisor@ethiosugar.local | Supervisor123! |
| Worker | worker@ethiosugar.local | Worker123! |

### API Documentation

Once deployed, access Swagger UI at:
```
https://your-render-url/api-docs
```

### Testing the API

1. **Health Check:**
   ```
   GET https://your-render-url/health
   ```

2. **Login:**
   ```
   POST https://your-render-url/api/v1/auth/login
   Body: {"email": "admin@ethiosugar.local", "password": "Admin123!"}
   ```

3. **Use Token:**
   ```
   Authorization: Bearer <your-token>
   ```

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/v1/auth/login | Login | Public |
| POST | /api/v1/auth/register | Register user | Admin |
| GET | /api/v1/users | List users | Admin |
| PATCH | /api/v1/users/:id | Update user | Admin |
| DELETE | /api/v1/users/:id | Deactivate user | Admin |
| POST | /api/v1/fields | Create field | Admin |
| GET | /api/v1/fields | List fields | Auth |
| PATCH | /api/v1/fields/:id | Update field | Admin |
| POST | /api/v1/incidents | Create incident | Worker/Supervisor |
| GET | /api/v1/incidents | List incidents | Auth |
| PATCH | /api/v1/incidents/:id/status | Update status | Supervisor/Admin |
| POST | /api/v1/irrigation-logs | Create log | Worker/Supervisor |
| GET | /api/v1/irrigation-logs | List logs | Auth |
| GET | /api/v1/tasks | List tasks | Auth |
| PATCH | /api/v1/tasks/:id/status | Update task | Supervisor/Admin |
| GET | /internal/daily-summary | Daily summary | Internal token |

---

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check that Render's database is running
- Ensure database user has proper permissions

### Webhook Not Working
- Verify n8n workflow is "Active"
- Check webhook URL is correct in .env
- Test webhook manually in n8n

### Authentication Issues
- Verify JWT_SECRET is set
- Check token expiration (24h)
- Ensure user isActive = true in database

---

## Support

For issues or questions, refer to:
- Backend Spec: `project backend description.md`
- API Spec: `openapi-spec.md`
- Prisma Schema: `prisma-schema.md`
