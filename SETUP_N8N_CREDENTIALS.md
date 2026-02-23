# n8n Credentials Setup Guide

## Quick Setup (Recommended)

### Step 1: Get Your n8n API Key

1. Open n8n in your browser: **http://localhost:5678**
2. Click on your **profile icon** (top-right corner)
3. Select **"Settings"**
4. Go to the **"API"** tab
5. Copy your **API Key** (or generate one if not exists)

### Step 2: Run the Setup Script

Create a file `.env.n8n` in the backend directory with your API key:

```bash
N8N_API_KEY=your-api-key-here
```

Then run:

```bash
node setup-n8n-credentials.js
```

---

## Manual Setup (Alternative)

If you prefer to set up credentials manually through the n8n UI:

### 1. Open n8n Credentials Page
- Go to: **http://localhost:5678/credentials**
- Or click **"Credentials"** in the left sidebar

### 2. Create HTTP Header Auth Credential

**Credential Name:** `ethiosugar-api`

**Type:** `HTTP Header Auth`

**Configuration:**
```
Name: ethiosugar-api
Type: HTTP Header Auth

Header Name: Authorization
Header Value: Bearer YOUR_JWT_TOKEN_HERE
```

**To get JWT Token:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ethiosugar.local","password":"Admin123!"}'
```

Copy the `token` value from the response and use it in the Header Value.

---

### 3. Create Telegram Bot API Credential

**Credential Name:** `ethiosugar-telegram`

**Type:** `Telegram Bot API`

**Configuration:**
```
Name: ethiosugar-telegram
Type: Telegram Bot API

Access Token: 8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q
```

---

## Verification

After setting up credentials, verify they work:

### Test Backend API Credential:
```bash
curl http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test Telegram Bot:
Open Telegram and send a message to your bot, or run:
```bash
curl "https://api.telegram.org/bot8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q/getMe"
```

Expected response:
```json
{
  "ok": true,
  "result": {
    "id": 8376747219,
    "is_bot": true,
    "first_name": "Your Bot Name",
    "username": "your_bot_name"
  }
}
```

---

## Workflow-Specific Configuration

### Workflow 1 & 4: Task Distributor & Summary Report

The workflows use these credentials:
- **ethiosugar-api**: For backend API calls
- **ethiosugar-telegram**: For sending notifications

### Workflow 2: Weather Irrigation

Uses:
- **ethiosugar-api**: For updating task status
- **ethiosugar-telegram**: For supervisor notifications

### Workflow 3: Disease Detection

Uses:
- **ethiosugar-telegram**: For user notifications
- **HuggingFace API**: For AI detection (needs separate setup)

---

## Troubleshooting

### Issue: "Credential not found" in workflow

**Solution:**
1. Make sure credential name matches exactly (case-sensitive)
2. Credential must be created before importing workflow
3. Try re-selecting the credential in each node

### Issue: "Invalid token" error

**Solution:**
1. Generate a fresh JWT token from login endpoint
2. Update the HTTP Header Auth credential with new token
3. Token expires after 24 hours (configured in backend)

### Issue: Telegram bot not responding

**Solution:**
1. Verify bot token is correct
2. Make sure bot is not blocked
3. Test with `/start` command in Telegram
4. Check bot privacy settings

---

## Next Steps

After credentials are set up:

1. **Import Workflows:**
   - Go to n8n → Workflows → Import
   - Select JSON files from `/n8n-workflows/`

2. **Activate Workflows:**
   - Open each workflow
   - Toggle the "Active" switch (top-right)

3. **Test Execution:**
   - Click "Execute Workflow" to test
   - Check executions tab for results

---

## Security Notes

⚠️ **Production Checklist:**
- [ ] Change default passwords
- [ ] Use environment variables for sensitive data
- [ ] Enable n8n authentication
- [ ] Use HTTPS for webhooks
- [ ] Rotate JWT tokens regularly
- [ ] Restrict CORS origins

---

**Created:** February 23, 2026  
**For:** EthioSugar Farm Automation Project
