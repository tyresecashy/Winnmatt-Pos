# M-Pesa Sandbox Testing - EXACT COMMANDS & SCENARIOS

## 🚀 QUICK START - Copy These Exact Commands

### Step 1: Get Authorization Token
```bash
curl -X GET "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
  -H "Authorization: Basic $(echo -n 'jb04YB03iq9FYD3lAwkMtvnRn2XrAN0ip1nP4imfRiFMi8vk:hAES1Axv2aREBHctvpd4PpFSUfcvGcJWD3KGCmOyIyjQNLzHfCPW87WOyV8OAXOE' | base64)"
```

**Response:**
```json
{
  "access_token": "YOUR_TOKEN_HERE",
  "expires_in": 3599
}
```
Copy the `access_token` for next steps.

---

### Step 2: Generate STK Push
Once you have `access_token` and `PASSKEY` from Daraja:

```bash
# Variables (customize):
CONSUMER_KEY="jb04YB03iq9FYD3lAwkMtvnRn2XrAN0ip1nP4imfRiFMi8vk"
CONSUMER_SECRET="hAES1Axv2aREBHctvpd4PpFSUfcvGcJWD3KGCmOyIyjQNLzHfCPW87WOyV8OAXOE"
PASSKEY="YOUR_PASSKEY_FROM_DARAJA"
PAYBILL="522533"
ACCOUNT_REF="7617748"
PHONE="254712345678"  # Customer phone
AMOUNT="100"
NGROK_URL="https://YOUR-NGROK-ID.ngrok.io"  # Your ngrok URL

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Generate password (base64 of paybill+passkey+timestamp)
PASSWORD=$(echo -n "${PAYBILL}${PASSKEY}${TIMESTAMP}" | base64)

# Get access token
TOKEN=$(curl -s -X GET "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
  -H "Authorization: Basic $(echo -n "${CONSUMER_KEY}:${CONSUMER_SECRET}" | base64)" \
  | jq -r '.access_token')

echo "Token: $TOKEN"
echo "Password: $PASSWORD"
echo "Timestamp: $TIMESTAMP"

# Send STK Push
curl -X POST "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"BusinessShortCode\": \"${PAYBILL}\",
    \"Password\": \"${PASSWORD}\",
    \"Timestamp\": \"${TIMESTAMP}\",
    \"TransactionType\": \"CustomerPayBillOnline\",
    \"Amount\": ${AMOUNT},
    \"PartyA\": \"${PHONE}\",
    \"PartyB\": \"${PAYBILL}\",
    \"PhoneNumber\": \"${PHONE}\",
    \"CallBackURL\": \"${NGROK_URL}/api/mpesa/callback\",
    \"AccountReference\": \"${ACCOUNT_REF}\",
    \"TransactionDesc\": \"POS Sale - Test\"
  }"
```

**Success Response:**
```json
{
  "MerchantRequestID": "17614-42849-2",
  "CheckoutRequestID": "ws_CO_XXXXXXXXXXXXX",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}
```

**Save the `CheckoutRequestID`** - you'll need it for callback and status checks.

---

### Step 3: Simulate Successful Payment (Manual Callback)
Once you get `CheckoutRequestID` from Step 2, use it here:

```bash
NGROK_URL="https://YOUR-NGROK-ID.ngrok.io"
CHECKOUT_REQUEST_ID="ws_CO_XXXXXXXXXXXXX"  # From Step 2
MPESA_RECEIPT="LIK123456"

curl -X POST "${NGROK_URL}/api/mpesa/callback" \
  -H "Content-Type: application/json" \
  -d "{
    \"Body\": {
      \"stkCallback\": {
        \"MerchantRequestID\": \"17614-42849-2\",
        \"CheckoutRequestID\": \"${CHECKOUT_REQUEST_ID}\",
        \"ResultCode\": 0,
        \"ResultDesc\": \"The service request has been processed successfully.\",
        \"Amount\": 100,
        \"MpesaReceiptNumber\": \"${MPESA_RECEIPT}\",
        \"TransactionDate\": \"$(date +%Y%m%d%H%M%S)\",
        \"PhoneNumber\": 254712345678
      }
    }
  }"
```

**Expected Response:** `{"status": "received"}`  
**Expected UI:** Spinner stops, shows "Payment Confirmed ✓", displays receipt

---

### Step 4: Check Payment Status (Query)
```bash
TOKEN="YOUR_TOKEN_FROM_STEP_1"
PASSKEY="YOUR_PASSKEY_FROM_DARAJA"
PAYBILL="522533"
CHECKOUT_REQUEST_ID="ws_CO_XXXXXXXXXXXXX"

TIMESTAMP=$(date +%Y%m%d%H%M%S)
PASSWORD=$(echo -n "${PAYBILL}${PASSKEY}${TIMESTAMP}" | base64)

curl -X POST "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"BusinessShortCode\": \"${PAYBILL}\",
    \"Password\": \"${PASSWORD}\",
    \"Timestamp\": \"${TIMESTAMP}\",
    \"CheckoutRequestID\": \"${CHECKOUT_REQUEST_ID}\"
  }"
```

**Response - Completed:**
```json
{
  "ResponseCode": "0",
  "ResponseDescription": "The service request has been processed successfully.",
  "MerchantRequestID": "17614-42849-2",
  "CheckoutRequestID": "ws_CO_XXXXXXXXXXXXX",
  "ResultCode": 0,
  "ResultDesc": "The service request has been processed successfully.",
  "Amount": "100",
  "MpesaReceiptNumber": "LIK123456"
}
```

**Response - Cancelled/Pending:**
```json
{
  "ResponseCode": "0",
  "MerchantRequestID": "17614-42849-2",
  "CheckoutRequestID": "ws_CO_XXXXXXXXXXXXX",
  "ResultCode": 1,
  "ResultDesc": "Bad request - Invalid identifier"
}
```

---

## 🧪 TESTING SCENARIOS

### Scenario 1: Successful Payment (Real Phone)
**Precondition:** You have a real M-Pesa sandbox account for testing  
**Steps:**
1. Go to http://localhost:3000/pos
2. Add product, click Checkout
3. Select M-Pesa
4. Enter your real M-Pesa sandbox phone
5. Click "Send STK Push"
6. You get prompt on phone (real device)
7. Enter PIN to complete
8. UI auto-detects callback from Daraja
9. See receipt

**Expected Result:** ✅ Payment confirmed, sale completed, receipt printed

---

### Scenario 2: Simulated Success (No Real Phone Needed)
**Precondition:** ngrok running, passkey configured  
**Steps:**
1. Go to http://localhost:3000/pos
2. Add product, click Checkout
3. Select M-Pesa
4. Enter fake phone: **0712345678**
5. Click "Send STK Push"
6. UI shows waiting spinner
7. In terminal, run Step 3 callback command (use CheckoutRequestID from logs)
8. Watch UI: Should immediately switch to "Payment Confirmed"

**Expected Result:** ✅ Simulated payment works, UI updates correctly

---

### Scenario 3: User Cancels (Timeout)
**Precondition:** Phone prompt sent but not responded  
**Expected Behavior:**
- UI waits 3 minutes
- Shows "Payment request timed out - Retry?"
- Sale remains `payment_status = 'pending'`
- Clicking Retry creates new STK Push

**How to Test:**
1. Send STK Push (phone prompt shows)
2. Ignore the phone prompt
3. Wait 3 minutes (or manually click "Timeout" in test UI)

---

### Scenario 4: Insufficient Funds
**Precondition:** Customer tries to pay more than M-Pesa balance  
**Daraja Response:**
```json
{
  "ResultCode": 1032,
  "ResultDesc": "Request cancelled by user"
}
```
**Expected UI:** "Payment failed: Insufficient balance. Try again?"

---

### Scenario 5: Wrong Passkey
**Precondition:** MPESA_PASSKEY in .env.local is incorrect  
**Expected Error (from Daraja):**
```json
{
  "MerchantRequestID": "xxx",
  "CheckoutRequestID": "xxx",
  "ResponseCode": "1",
  "ResponseDescription": "Invalid credentials",
  "CustomerMessage": "Service failed. Try again later"
}
```
**Expected UI:** Red error toast: "Invalid M-Pesa configuration. Contact support."

---

### Scenario 6: Offline/Network Error
**Precondition:** Daraja unreachable (simulate via offline)  
**Expected Behavior:**
- No ResponseCode received
- Timeout (30 seconds)
- UI shows: "Network error. Check connection."
- Sale remains pending

---

### Scenario 7: Double Payment Prevention
**Precondition:** Callback arrives twice with same CheckoutRequestID  
**Expected Behavior:**
- First callback: ResultCode=0, updates sale to completed
- Second callback: Database UNIQUE constraint prevents duplicate, returns 200 OK safely
- Payment recorded once only

**Database Protection:**
```sql
UNIQUE(checkout_request_id)  -- Prevents duplicate processing
```

---

## 📋 TESTING CHECKLIST

Before declaring M-Pesa "working":

- [ ] Passkey obtained from Daraja dashboard
- [ ] ngrok tunnel running and `.env.local` updated
- [ ] Dev server restarted (`npm run dev`)
- [ ] Database migration applied (`mpesa_transactions` table exists)
- [ ] Token generation works (Step 1 curl returns access_token)
- [ ] STK Push initiates (Step 2 curl returns CheckoutRequestID)
- [ ] UI shows waiting spinner after Send STK Push
- [ ] Manual callback updates database (Step 3 curl triggers update)
- [ ] UI detects payment confirmation within polling interval
- [ ] Receipt displays correctly after confirmation
- [ ] Retry works if user cancels first attempt
- [ ] Error messages display for network failures
- [ ] Payment amount matches cart total exactly
- [ ] Phone number normalized correctly (0712... → 254712...)
- [ ] Account reference included in request (7617748)
- [ ] Transaction type correct (CustomerPayBillOnline)

---

## 🔍 DEBUGGING CHECKLIST

If payment doesn't work:

1. **Check Passkey**
   ```bash
   grep MPESA_PASSKEY .env.local
   # Should show: MPESA_PASSKEY=<32+ char string>
   ```

2. **Check ngrok running**
   ```bash
   # Terminal window 2 should show:
   # Forwarding   https://abc-123.ngrok.io → http://localhost:3000
   curl https://abc-123.ngrok.io/health  # Should work
   ```

3. **Check .env.local has callback URL**
   ```bash
   grep MPESA_CALLBACK_URL .env.local
   # Should show: MPESA_CALLBACK_URL=https://abc-123.ngrok.io/api/mpesa/callback
   ```

4. **Check dev server restarted**
   ```bash
   # Stop: Ctrl+C in Terminal 1
   # Start: npm run dev
   # Watch for: ✓ Ready in X ms
   ```

5. **Check database migration**
   ```bash
   # Supabase SQL Editor:
   SELECT COUNT(*) FROM mpesa_transactions;
   # Should work (not "table doesn't exist" error)
   ```

6. **Check logs in browser**
   ```bash
   # Open DevTools (F12)
   # Click Console tab
   # Look for: "STK Push response", "Polling status", etc.
   ```

7. **Check server logs**
   ```bash
   # Terminal 1 (npm run dev) should show:
   # POST /api/mpesa/stk-push 200
   # POST /api/mpesa/callback 200
   # GET /api/mpesa/status 200
   ```

---

## 🎓 UNDERSTANDING THE FLOW

```
User at POS
    ↓
1. Adds product, clicks Checkout
    ↓
2. Frontend: POST /api/sales?create-pending
    ├→ Creates sale with payment_status='pending'
    └→ Returns sale_id
    ↓
3. User selects M-Pesa, enters phone 0712345678
    ↓
4. Frontend: POST /api/mpesa/stk-push
    ├→ Body: { saleId, phone, amount }
    ├→ Backend gets access_token from Daraja
    ├→ Backend generates password (Base64 of paybill+passkey+timestamp)
    ├→ Backend calls Daraja STK Push endpoint
    ├→ Daraja returns CheckoutRequestID
    ├→ Backend stores in database
    └→ Returns CheckoutRequestID to frontend
    ↓
5. Frontend: Shows waiting spinner + countdown (3 minutes)
    ├→ Every 2 seconds: GET /api/mpesa/status?checkoutRequestId=xxx
    ├→ Server checks database for callback result
    └→ Cancellable: User can click "Cancel" to exit
    ↓
6. [Meanwhile] Daraja sends callback to your ngrok URL
    ├→ POST https://your-ngrok.ngrok.io/api/mpesa/callback
    ├→ Backend receives Body.stkCallback
    ├→ Backend extracts CheckoutRequestID, ResultCode, MpesaReceiptNumber
    ├→ Backend updates mpesa_transactions table
    ├→ If ResultCode=0: Updates sale to payment_status='completed'
    └→ If ResultCode≠0: Keeps pending, user can retry
    ↓
7. Frontend's polling detects status change
    ├→ GET /api/mpesa/status returns confirmed: true
    ├→ Spinner stops
    ├→ Shows "Payment Confirmed ✓" + receipt
    └→ Resets form for next sale
    ↓
8. Sale completed, inventory deducted, receipt printed
```

---

## 📞 GETTING PASSKEY (If Stuck)

### Method 1: Daraja Dashboard (usually works)
1. Go https://developer.safaricom.co.ke
2. Login
3. "My Apps" → Your app
4. "Credentials" section
5. Copy "Passkey" (32+ chars)

### Method 2: Email Safaricom (48-hour response)
Subject: "STK Push Passkey Request"
```
Hello,

I've created an app for STK Push (Lipa Na M-Pesa Online) 
in sandbox with PayBill: 522533

I need the Passkey for password generation.

App Name: [Your app name]
PayBill: 522533

Thank you,
[Your name]
```
Send to: dev@safaricom.co.ke

### Method 3: Chat Support
- Go https://developer.safaricom.co.ke
- Click chat (bottom right)
- Say: "I need passkey for my STK Push app"

---

## ✅ SUCCESS INDICATORS

When everything works:

1. ✅ Passkey is set in `.env.local`
2. ✅ ngrok tunnel shows `Forwarding https://...ngrok.io`
3. ✅ Dev server shows no errors in console
4. ✅ Database migration applied (table exists)
5. ✅ Token generation works (curl Step 1)
6. ✅ STK Push works (curl Step 2 → CheckoutRequestID)
7. ✅ Callback receipt works (curl Step 3 → updates UI)
8. ✅ Full sandbox test passes (real phone OR simulated)
9. ✅ POS shows receipt after payment
10. ✅ Database records transaction with receipt number

---

## ❓ COMMON MISTAKES TO AVOID

- ❌ Wrong passkey format (not base64, just the string)
- ❌ Forgot to restart dev server after .env.local changes
- ❌ ngrok URL changed but .env.local not updated
- ❌ Using wrong phone format (must be 254... or 0... - code normalizes)
- ❌ Amount as string instead of number
- ❌ Timestamp wrong format (must be YYYYMMDDHHmmss)
- ❌ Using 174379 as PayBill instead of 522533
- ❌ Not encoding password in base64
- ❌ Callback URL unreachable (ngrok not running)
- ❌ Database migration not applied

---

**Next Step:** Get Passkey + Setup ngrok, then run the commands above in order.
