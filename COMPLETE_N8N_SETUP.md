# ✅ Complete n8n Setup Guide for EthioSugar

## 🎯 What You'll Set Up

This guide will help you configure n8n credentials and import workflows for the EthioSugar farm automation system.

---

## 📋 Prerequisites

- ✅ n8n running on http://localhost:5678
- ✅ Backend running on http://localhost:3001
- ✅ Telegram bot token: `8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q`

---

## 🔐 Part 1: Create Credentials in n8n

### Step 1: Open Credentials Page

1. Open browser: **http://localhost:5678/credentials**
2. Click **"Add Credential"** button (top-right corner)

---

### Step 2: Create Telegram Credential

1. **Search** for `telegram` in the credential type search box
2. **Select** "Telegram Bot API"
3. **Configure:**
   - **Name:** `ethiosugar-telegram`
   - **Access Token:** `8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q`
4. **Click** "Save"

**Expected Result:** ✅ Green checkmark appears

---

### Step 3: Create API Credential

1. **Click** "Add Credential" again
2. **Search** for `http header`
3. **Select** "HTTP Header Auth"
4. **Configure:**
   - **Name:** `ethiosugar-api`
   - **Header Name:** `Authorization`
   - **Header Value:** 
     ```
     Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImU5OTMzN2U0LWFkYzAtNDg2Mi05YmJkLTlhNmZmMTRmNzhiMCIsImVtYWlsIjoiYWRtaW5AZXRoaW9zdWdhci5sb2NhbCIsInJvbGUiOiJBRE1JTiIsImlhdCI6MTc3MTg0MDE3MywiZXhwIjoxNzcxOTI2NTczfQ.wGWDgGQ0Przx7p0pMvFEPaHtOxm2LZe6hQPuXTFy510
     ```
5. **Click** "Save"

**Expected Result:** ✅ Green checkmark appears

---

### Step 4: Verify Credentials

Go to **http://localhost:5678/credentials**

You should see:
```
✅ ethiosugar-api         HTTP Header Auth
✅ ethiosugar-telegram    Telegram Bot API
```

---

## 📥 Part 2: Import Workflows

### Step 1: Open Workflows Page

Navigate to: **http://localhost:5678/workflows**

---

### Step 2: Import Each Workflow

For each workflow file, do the following:

#### Workflow 1: Daily Task Distributor
1. **Click** "Import" (top-right)
2. **Select file:** `ethiosugar-backend/n8n-workflows/workflow-1-daily-task-distributor.json`
3. **Wait** for import to complete
4. **Click** "Save"
5. **Toggle** "Active" switch to ON (top-right)

#### Workflow 2: Weather Irrigation Monitor
1. **Click** "Import"
2. **Select file:** `ethiosugar-backend/n8n-workflows/workflow-2-weather-irrigation-monitor.json`
3. **Click** "Save"
4. **Toggle** "Active" to ON

#### Workflow 3: Image Disease Detection
1. **Click** "Import"
2. **Select file:** `ethiosugar-backend/n8n-workflows/workflow-3-image-disease-detection.json`
3. **Click** "Save"
4. **Toggle** "Active" to ON

#### Workflow 4: Daily Summary Report
1. **Click** "Import"
2. **Select file:** `ethiosugar-backend/n8n-workflows/workflow-4-daily-summary-report.json`
3. **Click** "Save"
4. **Toggle** "Active" to ON

---

### Step 3: Verify Workflows

Go to **http://localhost:5678/workflows**

You should see 4 active workflows:
```
✅ Daily Task Distributor          Active
✅ Weather Irrigation Monitor      Active
✅ Image Disease Detection         Active
✅ Daily Summary Report            Active
```

---

## 🧪 Part 3: Test the Setup

### Test 1: Run Test Script

```bash
cd "C:\Users\hp\ALL PROJECTS\Leul Projects\Ethio-sugar\ethiosugar-backend"
node test-n8n-workflows.js
```

**Expected Output:**
```
✅ 8/10 tests passed
✅ Workflow 1: READY
✅ Workflow 2: READY
⚠️  Workflow 3: PARTIAL (HuggingFace issue)
✅ Workflow 4: READY
```

---

### Test 2: Manual Workflow Test

#### Test Daily Task Distributor
1. Open workflow in n8n
2. Click "Execute Workflow" button
3. Check execution results
4. Verify Telegram message received

#### Test Daily Summary Report
1. Open workflow
2. Click "Execute Workflow"
3. Check for summary message in Telegram

---

## 🔧 Troubleshooting

### Issue: "Credential not found"

**Solution:**
1. Open workflow in editor
2. Click on any node that uses credentials
3. Re-select the credential from dropdown
4. Save workflow

---

### Issue: "Token expired" (Backend API)

The JWT token expires after 24 hours. To refresh:

```bash
# Get new token
curl -X POST http://localhost:3001/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@ethiosugar.local\",\"password\":\"Admin123!\"}"

# Copy the new token and update ethiosugar-api credential in n8n
```

---

### Issue: Telegram bot not responding

**Solution:**
1. Open Telegram
2. Search: `@ethiosugurbot`
3. Send: `/start`
4. If no response, check:
   - Bot token is correct
   - Bot is not blocked
   - Internet connection

---

### Issue: Workflow not triggering

**Solution:**
1. Make sure workflow is **Active** (toggle ON)
2. Check n8n execution logs
3. Verify trigger schedule is correct
4. Test manually with "Execute Workflow" button

---

## 📊 Workflow Summary

| Workflow | Trigger | Purpose | Status |
|----------|---------|---------|--------|
| Daily Task Distributor | Every 6 hours | Send tasks to workers | ✅ Ready |
| Weather Irrigation Monitor | Every 3 hours | Postpone irrigation if rain | ✅ Ready |
| Image Disease Detection | Telegram webhook | AI disease detection | ⚠️ Needs HuggingFace fix |
| Daily Summary Report | 6:00 PM daily | Send daily summary to admin | ✅ Ready |

---

## 🔐 Credential Renewal

### JWT Token (ethiosugar-api)

**Expires:** Every 24 hours

**Renew with:**
```bash
curl -X POST http://localhost:3001/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@ethiosugar.local\",\"password\":\"Admin123!\"}"
```

Update the credential in n8n with the new token.

### Telegram Token (ethiosugar-telegram)

**Expires:** Never (unless revoked)

**No renewal needed** unless you regenerate the bot token.

---

## 📁 File Locations

```
ethiosugar-backend/
├── n8n-credentials/
│   ├── ethiosugar-api.json
│   └── ethiosugar-telegram.json
├── n8n-workflows/
│   ├── workflow-1-daily-task-distributor.json
│   ├── workflow-2-weather-irrigation-monitor.json
│   ├── workflow-3-image-disease-detection.json
│   └── workflow-4-daily-summary-report.json
├── setup-n8n-credentials.js
├── test-n8n-workflows.ts
├── SETUP_CREDENTIALS_MANUAL.md
└── WORKFLOW_TEST_REPORT.md
```

---

## ✅ Setup Complete Checklist

- [ ] Created `ethiosugar-telegram` credential
- [ ] Created `ethiosugar-api` credential
- [ ] Imported all 4 workflows
- [ ] Activated all workflows
- [ ] Tested workflow execution
- [ ] Verified Telegram notifications

---

**Need Help?** 

- Check logs at: http://localhost:5678/executions
- Review test report: `WORKFLOW_TEST_REPORT.md`
- Re-run tests: `node test-n8n-workflows.js`

---

**Created:** February 23, 2026  
**For:** EthioSugar Farm Automation
