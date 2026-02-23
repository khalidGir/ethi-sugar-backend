# 🔐 n8n Credentials - Step-by-Step Setup

## Quick Overview

You need to create **2 credentials** in n8n:
1. **ethiosugar-api** - For backend API authentication
2. **ethiosugar-telegram** - For Telegram bot

---

## 📋 Step 1: Open n8n Credentials Page

1. Open your browser: **http://localhost:5678**
2. Click **"Credentials"** in the left sidebar
3. Click **"Add Credential"** button (top-right)

---

## 🔑 Step 2: Create Telegram Credential

### First Credential: ethiosugar-telegram

1. Click **"Add Credential"**
2. In the search box, type: `telegram`
3. Select **"Telegram Bot API"** from the list
4. Fill in:
   ```
   Name: ethiosugar-telegram
   Access Token: 8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q
   ```
5. Click **"Save"**

✅ **Verify:** You should see a green checkmark next to the credential name.

---

## 🛡️ Step 3: Create API Credential

### Second Credential: ethiosugar-api

1. Click **"Add Credential"** again
2. In the search box, type: `http`
3. Select **"HTTP Header Auth"** from the list
4. Fill in:
   ```
   Name: ethiosugar-api
   
   Header Name: Authorization
   Header Value: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU5OTMzN2U0LWFkYzAtNDg2Mi05YmJkLTlhNmZmMTRmNzhiMCIsImVtYWlsIjoiYWRtaW5AZXRoaW9zdWdhci5sb2NhbCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3MTg0MDE3MywiZXhwIjoxNzcxOTI2NTczfQ.wGWDgGQ0Przx7p0pMvFEPaHtOxm2LZe6hQPuXTFy510
   ```
5. Click **"Save"**

✅ **Verify:** You should see a green checkmark.

> ⚠️ **Note:** The JWT token expires after 24 hours. When it expires, generate a new one and update this credential.

---

## ✅ Step 4: Verify Credentials

After creating both credentials:

1. Go to **http://localhost:5678/credentials**
2. You should see:
   - ✅ `ethiosugar-api` (HTTP Header Auth)
   - ✅ `ethiosugar-telegram` (Telegram Bot API)

---

## 🧪 Step 5: Test Credentials

### Test Telegram Bot

1. Open Telegram
2. Search for: `@ethiosugurbot`
3. Send: `/start`
4. Bot should respond

### Test Backend API

Run this command:
```bash
curl http://localhost:3001/api/v1/tasks \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU5OTMzN2U0LWFkYzAtNDg2Mi05YmJkLTlhNmZmMTRmNzhiMCIsImVtYWlsIjoiYWRtaW5AZXRoaW9zdWdhci5sb2NhbCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3MTg0MDE3MywiZXhwIjoxNzcxOTI2NTczfQ.wGWDgGQ0Przx7p0pMvFEPaHtOxm2LZe6hQPuXTFy510"
```

Should return tasks data.

---

## 📥 Step 6: Import Workflows

After credentials are set up:

1. Go to **http://localhost:5678/workflows**
2. Click **"Import"** (top-right)
3. Select each JSON file from:
   ```
   ethiosugar-backend/n8n-workflows/
   ├── workflow-1-daily-task-distributor.json
   ├── workflow-2-weather-irrigation-monitor.json
   ├── workflow-3-image-disease-detection.json
   └── workflow-4-daily-summary-report.json
   ```
4. Import them one by one

---

## ▶️ Step 7: Activate Workflows

For each imported workflow:

1. Open the workflow
2. Toggle **"Active"** switch (top-right) to ON
3. Click **"Save"**

---

## 🔧 Troubleshooting

### "Credential not found" error

**Solution:** Make sure the credential names match exactly:
- `ethiosugar-api`
- `ethiosugar-telegram`

### "Token expired" error

**Solution:** Generate a new JWT token:
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ethiosugar.local","password":"Admin123!"}'
```

Then update the `ethiosugar-api` credential with the new token.

### Telegram bot not responding

**Solution:**
1. Make sure bot token is correct
2. In Telegram, search `@ethiosugurbot`
3. Send `/start`
4. Check bot privacy settings in BotFather

---

## 📝 Credential Summary

| Name | Type | Purpose |
|------|------|---------|
| ethiosugar-api | HTTP Header Auth | Backend API authentication |
| ethiosugar-telegram | Telegram Bot API | Send notifications to workers/admin |

---

**Need help?** Run the test script after setup:
```bash
node test-n8n-workflows.js
```
