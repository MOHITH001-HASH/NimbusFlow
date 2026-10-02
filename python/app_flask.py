"""
NimbusFlow - Autonomous AutoPay Voice Recovery Agent (Ava)
Flask Production Backend Implementation
"""
from flask import Flask, request, jsonify, make_response, Response
import os
import secrets
import hmac
import time
import json
from datetime import datetime
from typing import Dict, Any, List

from python.models import Customer
from python.services.store import store
from python.services.compliance import PythonComplianceService
from python.services.identity import identity_service
from python.services.policy import PythonPolicyEngine
from python.services.sms import payment_service
from python.services.agent_brain import agent_brain
from python.services.eval_runner import eval_runner

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

OPS_USER = os.environ.get("OPS_USER", "ops")
OPS_PASSWORD = os.environ.get("OPS_PASSWORD", "test")
SHARED_TOOL_SECRET = os.environ.get("SHARED_TOOL_SECRET", "nimbusflow-secure-secret-32-chars")

active_sessions: Dict[str, float] = {}
failed_auth_attempts: Dict[str, List[float]] = {}
sse_subscribers = []

def check_ops_auth():
    token = request.cookies.get("ops_session")
    if not token or token not in active_sessions:
        return False
    return True

def check_tool_secret():
    header_secret = request.headers.get("x-tool-secret") or request.headers.get("x-vapi-secret") or ""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    query_secret = request.args.get("secret", "")
    
    body = request.get_json(silent=True) or {}
    body_secret = body.get("message", {}).get("serverUrlSecret") or body.get("secret") or ""

    provided = header_secret or token or query_secret or body_secret
    if not provided or not hmac.compare_digest(provided, SHARED_TOOL_SECRET):
        return False
    return True

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, x-tool-secret, x-vapi-secret'
    return response

# Auth
@app.route("/api/auth/login", methods=["POST"])
def login():
    client_ip = request.remote_addr or "unknown"
    now = time.time()
    attempts = [t for t in failed_auth_attempts.get(client_ip, []) if now - t < 900]
    failed_auth_attempts[client_ip] = attempts

    if len(attempts) >= 5:
        return jsonify({"error": "Too many failed login attempts. Try again in 15 minutes."}), 429

    data = request.get_json(silent=True) or {}
    user = data.get("username", "")
    passwd = data.get("password", "")

    if not (hmac.compare_digest(user, OPS_USER) and hmac.compare_digest(passwd, OPS_PASSWORD)):
        attempts.append(now)
        failed_auth_attempts[client_ip] = attempts
        return jsonify({"error": "Invalid operator credentials."}), 401

    failed_auth_attempts.pop(client_ip, None)
    token = secrets.token_hex(32)
    active_sessions[token] = now
    resp = make_response(jsonify({"ok": True, "user": OPS_USER}))
    resp.set_cookie("ops_session", token, httponly=True, samesite="Strict", max_age=28800, path="/")
    return resp

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    if check_ops_auth():
        return jsonify({"authenticated": True, "user": OPS_USER})
    return jsonify({"authenticated": False})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    token = request.cookies.get("ops_session")
    if token:
        active_sessions.pop(token, None)
    resp = make_response(jsonify({"ok": True}))
    resp.delete_cookie("ops_session", path="/")
    return resp

# Customers
@app.route("/api/customers", methods=["GET"])
def get_customers():
    return jsonify(store.get_customers_sanitized())

@app.route("/api/customers", methods=["POST"])
def create_customer():
    if not check_ops_auth():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    if any(c.phone == phone for c in store.get_customers()):
        return jsonify({"error": "Another customer already uses this phone number."}), 409

    new_id = "cust_" + secrets.token_hex(4)
    cust = Customer(
        id=new_id,
        name=data.get("name", "New Subscriber"),
        phone=phone,
        email=data.get("email", ""),
        language=data.get("language", "en"),
        timezone=data.get("timezone", "Asia/Kolkata"),
        plan=data.get("plan", "NimbusFlow Growth Cloud"),
        amount_due=float(data.get("amount_due", 0)),
        currency=data.get("currency", "INR"),
        due_date=data.get("due_date", "2026-03-31"),
        last4=str(data.get("last4", "4242")),
        zip_code=str(data.get("zip_code", "560001")),
        failure_code=data.get("failure_code", "card_expired"),
        failure_reason=data.get("failure_reason", "Card expired"),
        payment_failures_count=1,
        call_attempts_count=0,
        tenure_months=12,
        segment=data.get("segment", "SMB"),
        consent_status=data.get("consent_status") is True,
        dnc_flag=bool(data.get("dnc_flag", False)),
        hardship_flag=bool(data.get("hardship_flag", False)),
        billing_hold=bool(data.get("billing_hold", False)),
        notes=data.get("notes", "Created via API"),
        persona_scenario=data.get("persona_scenario", "expired_card_cooperative")
    )
    store.add_customer(cust)
    return jsonify({"customer": new_id, "name": cust.name}), 201

@app.route("/api/customers/<cust_id>", methods=["GET"])
def get_customer(cust_id):
    cust = store.get_customer(cust_id)
    if not cust:
        return jsonify({"error": "Customer not found."}), 404
    data = store.get_customers_sanitized()
    found = next((c for c in data if c["id"] == cust_id), None)
    return jsonify({"customer": found})

@app.route("/api/customers/<cust_id>", methods=["PUT"])
def update_customer(cust_id):
    if not check_ops_auth():
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    if "phone" in data:
        p = str(data["phone"]).strip()
        if any(c.id != cust_id and c.phone == p for c in store.get_customers()):
            return jsonify({"error": "Another customer already uses this phone number."}), 409
        data["phone"] = p

    updated = store.update_customer(cust_id, data)
    if not updated:
        return jsonify({"error": "Customer not found."}), 404
    return jsonify({"customer": cust_id, "status": "updated"})

@app.route("/api/customers/<cust_id>", methods=["DELETE"])
def delete_customer(cust_id):
    if not check_ops_auth():
        return jsonify({"error": "Unauthorized"}), 401
    if store.delete_customer(cust_id):
        return jsonify({"success": True})
    return jsonify({"error": "Customer not found."}), 404

@app.route("/api/customers/<cust_id>/pre-call", methods=["GET"])
def pre_call(cust_id):
    cust = store.get_customer(cust_id)
    if not cust:
        return jsonify({"error": "Customer not found."}), 404
    res = PythonComplianceService.evaluate_pre_call(cust)
    return jsonify({
        "canDial": res.can_dial,
        "reasons": res.reasons,
        "localTime": res.local_time_formatted,
        "withinTcpaWindow": res.within_tcpa_window,
        "dncActive": res.dnc_active,
        "callLimitReached": res.call_limit_reached,
        "consentGiven": res.consent_given
    })

# Calling
@app.route("/api/calls/dial", methods=["POST"])
def dial_call():
    data = request.get_json(silent=True) or {}
    cust = store.get_customer(data.get("customerId", ""))
    if not cust:
        return jsonify({"error": "Customer not found."}), 404

    comp = PythonComplianceService.evaluate_pre_call(cust)
    if not comp.can_dial:
        return jsonify({"error": "; ".join(comp.reasons)}), 403

    call_id = "call_" + secrets.token_hex(6)
    sess, greeting = agent_brain.start_call(cust, call_id)
    store.record_call_session(sess)
    cust.call_attempts_count += 1

    return jsonify({
        "callId": call_id,
        "status": "connected",
        "initialGreeting": greeting,
        "customer": {"name": cust.name, "phone": cust.phone, "plan": cust.plan}
    })

@app.route("/api/calls/chat", methods=["POST"])
def chat_turn():
    data = request.get_json(silent=True) or {}
    cust = store.get_customer(data.get("customerId", ""))
    sess = store.calls.get(data.get("callId", ""))
    if not cust or not sess:
        return jsonify({"error": "Active call or customer not found."}), 404

    reply = agent_brain.process_turn(sess, cust, data.get("message", ""))
    return jsonify({
        "callId": sess.id,
        "state": sess.state,
        "reply": reply,
        "factorVerified": sess.factor_verified,
        "outcome": sess.outcome
    })

@app.route("/api/calls/end", methods=["POST"])
def end_call():
    data = request.get_json(silent=True) or {}
    sess = store.calls.get(data.get("callId", ""))
    if sess:
        sess.ended_at = datetime.utcnow().isoformat() + "Z"
        sess.outcome = data.get("outcome", sess.outcome or "completed")
    return jsonify({"status": "ended"})

# Payment
@app.route("/api/payments/pay", methods=["POST"])
def pay_link():
    data = request.get_json(silent=True) or {}
    res = payment_service.complete_payment(data.get("linkId", ""), data.get("paymentMethod", "UPI"))
    if not res["success"]:
        return jsonify({"error": "Payment link not found or expired."}), 404
    cid = res["link"]["customer_id"]
    store.update_customer(cid, {"amount_due": 0})
    return jsonify({"success": True, "status": "paid", "link": res["link"]})

# Vapi Webhook
@app.route("/api/vapi/webhook", methods=["POST"])
@app.route("/api/tools/vapi-webhook", methods=["POST"])
def vapi_webhook():
    if not check_tool_secret():
        return jsonify({"error": "Unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    message = body.get("message", body)
    tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
    call_phone = message.get("call", {}).get("customer", {}).get("number")
    provider_call_id = message.get("call", {}).get("id", "vapi_call")

    results = []
    for tc in tool_calls:
        name = tc.get("name") or tc.get("function", {}).get("name", "")
        tc_id = tc.get("id", "tc_1")
        args = tc.get("parameters") or tc.get("function", {}).get("arguments") or {}
        if isinstance(args, str):
            try:
                args = json.loads(args)
            except Exception:
                args = {}

        cust = next((c for c in store.get_customers() if c.phone == call_phone), None) if call_phone else None
        if not cust and not call_phone:
            cid = args.get("customerId") or args.get("customer_id")
            if cid:
                cust = store.get_customer(cid)

        is_verified = False
        if cust and provider_call_id:
            s = identity_service.get_session(provider_call_id)
            if s and s.factor_verified and not s.is_locked_out and s.customer_id == cust.id:
                is_verified = True

        out = {}
        if name == "verify_identity":
            if not cust:
                out = {"error": "Customer not found"}
            else:
                out = identity_service.verify_factor(provider_call_id, cust, args.get("factorType", "last4"), str(args.get("factorValue") or ""))
        elif name in ("create_payment_link", "send_payment_link"):
            if not cust:
                out = {"error": "Customer not found"}
            elif cust.dnc_flag:
                out = {"error": "compliance_blocked"}
            elif not is_verified:
                out = {"error": "identity_not_verified"}
            else:
                lnk = payment_service.create_payment_link(cust.id, cust.amount_due, cust.currency)
                out = {"success": True, "url": lnk["url"], "amount": cust.amount_due}
        elif name == "get_customer_context":
            if not cust:
                out = {"error": "Customer not found"}
            elif not is_verified:
                out = {"customerId": cust.id, "name": cust.name, "identityVerified": False}
            else:
                pol = PythonPolicyEngine.get_policy(cust)
                out = {"customerId": cust.id, "name": cust.name, "amountDue": cust.amount_due, "plan": cust.plan, "strategy": pol.strategy}
        elif name == "mark_do_not_call":
            if cust:
                store.mark_customer_dnc(cust.id)
                out = {"status": "dnc_applied"}
        elif name == "escalate_to_human":
            out = {"status": "escalated_to_supervisor"}

        results.append({"name": name, "toolCallId": tc_id, "result": json.dumps(out)})

    return jsonify({"results": results})

@app.route("/api/evals/run", methods=["POST"])
def run_evals():
    return jsonify(eval_runner.run_all_evals())

@app.route("/api/stats", methods=["GET"])
def stats():
    cs = store.get_customers()
    return jsonify({
        "total_customers": len(cs),
        "unpaid_count": sum(1 for c in cs if c.amount_due > 0),
        "dnc_count": sum(1 for c in cs if c.dnc_flag),
        "hardship_count": sum(1 for c in cs if c.hardship_flag)
    })

@app.route("/api/audit-log", methods=["GET"])
def audit():
    return jsonify(store.audit_logs)

@app.route("/api/reset", methods=["POST"])
def reset():
    store.reset_data()
    return jsonify({"status": "reset"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))
