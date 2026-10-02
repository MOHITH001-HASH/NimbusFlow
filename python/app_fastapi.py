"""
NimbusFlow - Autonomous AutoPay Voice Recovery Agent (Ava)
FastAPI Production Backend Implementation
"""
from fastapi import FastAPI, Request, Response, HTTPException, Depends, Query, Header, status
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
import os
import secrets
import hmac
import hashlib
import json
import asyncio
from datetime import datetime

from python.models import Customer, CallSession
from python.services.store import store
from python.services.compliance import PythonComplianceService
from python.services.identity import identity_service
from python.services.policy import PythonPolicyEngine
from python.services.sms import payment_service
from python.services.agent_brain import agent_brain
from python.services.eval_runner import eval_runner

app = FastAPI(
    title="NimbusFlow Autonomous Voice Recovery Engine",
    description="FastAPI-based server-side engine for NimbusFlow AutoPay Voice Recovery",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OPS_USER = os.environ.get("OPS_USER", "ops")
OPS_PASSWORD = os.environ.get("OPS_PASSWORD", "test")
SHARED_TOOL_SECRET = os.environ.get("SHARED_TOOL_SECRET", "nimbusflow-secure-secret-32-chars")

# Active sessions and rate limiting
active_sessions: Dict[str, float] = {}
failed_auth_attempts: Dict[str, List[float]] = {}
sse_queues: List[asyncio.Queue] = []

# Pydantic Schemas
class LoginRequest(BaseModel):
    username: str
    password: str

class CustomerCreateSchema(BaseModel):
    name: str = Field(..., min_length=2)
    phone: str = Field(..., min_length=7)
    email: str = Field(default="")
    language: str = Field(default="en")
    timezone: str = Field(default="Asia/Kolkata")
    plan: str = Field(default="NimbusFlow Growth Cloud")
    amount_due: float = Field(..., ge=0)
    currency: str = Field(default="INR")
    due_date: str = Field(default="2026-03-31")
    last4: str = Field(..., regex=r"^\d{4}$")
    zip_code: str = Field(default="560001")
    failure_code: str = Field(default="card_expired")
    failure_reason: str = Field(default="Card expired")
    segment: str = Field(default="SMB")
    consent_status: Optional[bool] = Field(default=False)
    dnc_flag: Optional[bool] = Field(default=False)
    hardship_flag: Optional[bool] = Field(default=False)
    billing_hold: Optional[bool] = Field(default=False)
    notes: Optional[str] = Field(default="")
    persona_scenario: Optional[str] = Field(default="expired_card_cooperative")

class CustomerUpdateSchema(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    language: Optional[str] = None
    timezone: Optional[str] = None
    plan: Optional[str] = None
    amount_due: Optional[float] = None
    currency: Optional[str] = None
    due_date: Optional[str] = None
    last4: Optional[str] = None
    zip_code: Optional[str] = None
    failure_code: Optional[str] = None
    failure_reason: Optional[str] = None
    segment: Optional[str] = None
    consent_status: Optional[bool] = None
    dnc_flag: Optional[bool] = None
    hardship_flag: Optional[bool] = None
    billing_hold: Optional[bool] = None
    notes: Optional[str] = None
    persona_scenario: Optional[str] = None

class DialRequest(BaseModel):
    customerId: str

class ChatTurnRequest(BaseModel):
    callId: str
    customerId: str
    message: str

class PaymentRequest(BaseModel):
    linkId: str
    paymentMethod: Optional[str] = "UPI"

# Security Dependencies
def verify_ops_auth(request: Request):
    token = request.cookies.get("ops_session")
    if not token or token not in active_sessions:
        raise HTTPException(status_code=401, detail="Unauthorized operator session.")
    return OPS_USER

def verify_tool_secret(
    request: Request,
    x_tool_secret: Optional[str] = Header(None),
    x_vapi_secret: Optional[str] = Header(None),
    authorization: Optional[str] = Header(None),
    secret: Optional[str] = Query(None)
):
    token = ""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    provided = x_tool_secret or x_vapi_secret or token or secret
    if not provided or not hmac.compare_digest(provided, SHARED_TOOL_SECRET):
        raise HTTPException(status_code=401, detail="Invalid or missing tool authentication secret.")
    return True

# Event Broadcast
async def broadcast_event(event_type: str, data: Any):
    payload = f"event: {event_type}\ndata: {json.dumps(data)}\n\n"
    for q in sse_queues:
        await q.put(payload)

# Authentication Routes
@app.post("/api/auth/login")
async def login(req: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    attempts = failed_auth_attempts.get(client_ip, [])
    now = asyncio.get_event_loop().time()
    attempts = [t for t in attempts if now - t < 900]
    failed_auth_attempts[client_ip] = attempts

    if len(attempts) >= 5:
        raise HTTPException(status_code=429, detail="Too many failed login attempts. Please try again in 15 minutes.")

    user_match = hmac.compare_digest(req.username, OPS_USER)
    pass_match = hmac.compare_digest(req.password, OPS_PASSWORD)

    if not (user_match and pass_match):
        attempts.append(now)
        failed_auth_attempts[client_ip] = attempts
        raise HTTPException(status_code=401, detail="Invalid operator credentials.")

    failed_auth_attempts.pop(client_ip, None)
    token = secrets.token_hex(32)
    active_sessions[token] = now
    response.set_cookie(key="ops_session", value=token, httponly=True, samesite="strict", max_age=28800, path="/")
    return {"ok": True, "user": OPS_USER}

@app.get("/api/auth/me")
async def get_current_user(request: Request):
    token = request.cookies.get("ops_session")
    if token and token in active_sessions:
        return {"authenticated": True, "user": OPS_USER}
    return {"authenticated": False}

@app.post("/api/auth/logout")
async def logout(response: Response, request: Request):
    token = request.cookies.get("ops_session")
    if token:
        active_sessions.pop(token, None)
    response.delete_cookie(key="ops_session", path="/")
    return {"ok": True}

# Customer Portfolio Routes
@app.get("/api/customers")
async def list_customers():
    return store.get_customers_sanitized()

@app.post("/api/customers", status_code=201)
async def create_customer(data: CustomerCreateSchema, auth: str = Depends(verify_ops_auth)):
    clean_phone = data.phone.strip()
    if any(c.phone == clean_phone for c in store.get_customers()):
        raise HTTPException(status_code=409, detail="Another customer already uses this phone number.")

    new_id = "cust_" + secrets.token_hex(4)
    cust = Customer(
        id=new_id,
        name=data.name,
        phone=clean_phone,
        email=data.email,
        language=data.language,
        timezone=data.timezone,
        plan=data.plan,
        amount_due=data.amount_due,
        currency=data.currency,
        due_date=data.due_date,
        last4=data.last4,
        zip_code=data.zip_code,
        failure_code=data.failure_code,
        failure_reason=data.failure_reason,
        payment_failures_count=1,
        call_attempts_count=0,
        tenure_months=12,
        segment=data.segment,
        consent_status=data.consent_status is True,
        dnc_flag=bool(data.dnc_flag),
        hardship_flag=bool(data.hardship_flag),
        billing_hold=bool(data.billing_hold),
        notes=data.notes or "Created via API",
        persona_scenario=data.persona_scenario or "expired_card_cooperative"
    )
    store.add_customer(cust)
    return {"customer": new_id, "name": cust.name}

@app.get("/api/customers/{customer_id}")
async def get_customer_detail(customer_id: str):
    cust = store.get_customer(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")
    data = store.get_customers_sanitized()
    found = next((c for c in data if c["id"] == customer_id), None)
    return {"customer": found}

@app.put("/api/customers/{customer_id}")
async def update_customer(customer_id: str, data: CustomerUpdateSchema, auth: str = Depends(verify_ops_auth)):
    existing = store.get_customer(customer_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Customer not found.")

    patch = {k: v for k, v in data.dict(exclude_unset=True).items() if v is not None}
    if "phone" in patch:
        clean_phone = patch["phone"].strip()
        if any(c.id != customer_id and c.phone == clean_phone for c in store.get_customers()):
            raise HTTPException(status_code=409, detail="Another customer already uses this phone number.")
        patch["phone"] = clean_phone

    store.update_customer(customer_id, patch)
    return {"customer": customer_id, "status": "updated"}

@app.delete("/api/customers/{customer_id}")
async def delete_customer(customer_id: str, auth: str = Depends(verify_ops_auth)):
    deleted = store.delete_customer(customer_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return {"success": True, "message": f"Customer {customer_id} removed."}

@app.get("/api/customers/{customer_id}/pre-call")
async def evaluate_pre_call_gate(customer_id: str):
    cust = store.get_customer(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")
    res = PythonComplianceService.evaluate_pre_call(cust)
    return {
        "canDial": res.can_dial,
        "reasons": res.reasons,
        "localTime": res.local_time_formatted,
        "withinTcpaWindow": res.within_tcpa_window,
        "dncActive": res.dnc_active,
        "callLimitReached": res.call_limit_reached,
        "consentGiven": res.consent_given
    }

# Outbound Voice Calling Routes
@app.post("/api/calls/dial")
async def dial_customer(req: DialRequest):
    cust = store.get_customer(req.customerId)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found.")

    compliance = PythonComplianceService.evaluate_pre_call(cust)
    if not compliance.can_dial:
        raise HTTPException(status_code=403, detail="; ".join(compliance.reasons))

    call_id = "call_" + secrets.token_hex(6)
    session, initial_greeting = agent_brain.start_call(cust, call_id)
    store.record_call_session(session)
    cust.call_attempts_count += 1

    return {
        "callId": call_id,
        "status": "connected",
        "initialGreeting": initial_greeting,
        "customer": {"name": cust.name, "phone": cust.phone, "plan": cust.plan}
    }

@app.post("/api/calls/chat")
async def process_call_turn(req: ChatTurnRequest):
    cust = store.get_customer(req.customerId)
    session = store.calls.get(req.callId)
    if not cust or not session:
        raise HTTPException(status_code=404, detail="Active call or customer not found.")

    reply = agent_brain.process_turn(session, cust, req.message)
    return {
        "callId": session.id,
        "state": session.state,
        "reply": reply,
        "factorVerified": session.factor_verified,
        "outcome": session.outcome
    }

@app.post("/api/calls/end")
async def end_call(req: Dict[str, Any]):
    call_id = req.get("callId")
    session = store.calls.get(call_id)
    if session:
        session.ended_at = datetime.utcnow().isoformat() + "Z"
        session.outcome = req.get("outcome", session.outcome or "completed")
    return {"status": "ended"}

# Server-Sent Events (SSE) Stream
@app.get("/api/calls/events")
@app.get("/api/events")
async def events_stream():
    queue = asyncio.Queue()
    sse_queues.append(queue)

    async def event_generator():
        try:
            yield "event: connected\ndata: {}\n\n"
            while True:
                msg = await queue.get()
                yield msg
        except asyncio.CancelledError:
            sse_queues.remove(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Payment Portal Route
@app.post("/api/payments/pay")
async def process_payment(req: PaymentRequest):
    res = payment_service.complete_payment(req.linkId, req.paymentMethod or "UPI")
    if not res["success"]:
        raise HTTPException(status_code=404, detail="Payment link not found or expired.")

    cust_id = res["link"]["customer_id"]
    store.update_customer(cust_id, {"amount_due": 0})
    cust = store.get_customer(cust_id)

    # Real-time SSE alert to live ongoing call
    await broadcast_event("payment_confirmed", {
        "customerId": cust_id,
        "customerName": cust.name if cust else "",
        "amount": res["link"]["amount"],
        "transactionId": res["link"]["transaction_id"],
        "status": "paid"
    })

    return {"success": True, "status": "paid", "link": res["link"]}

# Vapi Webhook Routes
@app.post("/api/vapi/webhook")
@app.post("/api/tools/vapi-webhook")
async def vapi_webhook(request: Request, auth: bool = Depends(verify_tool_secret)):
    body = await request.json()
    message = body.get("message", body)
    tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
    call_phone = message.get("call", {}).get("customer", {}).get("number")
    provider_call_id = message.get("call", {}).get("id", "vapi_call")

    results = []
    for tc in tool_calls:
        func_name = tc.get("name") or tc.get("function", {}).get("name", "")
        tc_id = tc.get("id", "tc_1")
        args = tc.get("parameters") or tc.get("function", {}).get("arguments") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}

        # Resolve customer prioritizing dialed phone number
        cust = None
        if call_phone:
            cust = next((c for c in store.get_customers() if c.phone == call_phone), None)
        if not cust and not call_phone:
            cid = args.get("customerId") or args.get("customer_id")
            if cid:
                cust = store.get_customer(cid)

        # Check identity verification state on this provider call
        is_verified = False
        if cust and provider_call_id:
            sess = identity_service.get_session(provider_call_id)
            if sess and sess.factor_verified and not sess.is_locked_out and sess.customer_id == cust.id:
                is_verified = True

        out: Dict[str, Any] = {}
        if func_name == "verify_identity":
            if not cust:
                out = {"error": "Customer not found"}
            else:
                factor_type = args.get("factorType", "last4")
                val = str(args.get("factorValue") or args.get("value") or "")
                out = identity_service.verify_factor(provider_call_id, cust, factor_type, val)

        elif func_name in ("create_payment_link", "send_payment_link"):
            if not cust:
                out = {"error": "Customer not found"}
            elif cust.dnc_flag:
                out = {"error": "compliance_blocked", "message": "Customer on Do-Not-Call list"}
            elif not is_verified:
                out = {"error": "identity_not_verified", "requiresVerification": True}
            else:
                link = payment_service.create_payment_link(cust.id, cust.amount_due, cust.currency)
                out = {"success": True, "url": link["url"], "amount": cust.amount_due}

        elif func_name == "get_customer_context":
            if not cust:
                out = {"error": "Customer not found"}
            elif not is_verified:
                out = {"customerId": cust.id, "name": cust.name, "identityVerified": False, "note": "Identity verification required before disclosing account details."}
            else:
                pol = PythonPolicyEngine.get_policy(cust)
                out = {"customerId": cust.id, "name": cust.name, "amountDue": cust.amount_due, "plan": cust.plan, "strategy": pol.strategy}

        elif func_name == "mark_do_not_call":
            if cust:
                store.mark_customer_dnc(cust.id)
                out = {"success": True, "status": "dnc_applied"}
            else:
                out = {"error": "Customer not found"}

        elif func_name == "escalate_to_human":
            out = {"status": "escalated_to_supervisor", "customerId": cust.id if cust else "unknown"}

        results.append({"name": func_name, "toolCallId": tc_id, "result": json.dumps(out)})

    return {"results": results}

# Evaluation Benchmark Route
@app.post("/api/evals/run")
async def run_compliance_evals():
    return eval_runner.run_all_evals()

# Reporting & System Routes
@app.get("/api/stats")
async def get_system_stats():
    custs = store.get_customers()
    return {
        "total_customers": len(custs),
        "unpaid_count": sum(1 for c in custs if c.amount_due > 0),
        "dnc_count": sum(1 for c in custs if c.dnc_flag),
        "hardship_count": sum(1 for c in custs if c.hardship_flag)
    }

@app.get("/api/audit-log")
async def get_audit_trail():
    return store.audit_logs

@app.post("/api/reset")
async def reset_store():
    store.reset_data()
    return {"status": "reset", "customersCount": len(store.get_customers())}
