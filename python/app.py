import http.server
import json
import os
import sys
import secrets
import hmac
import hashlib
from typing import Dict, Any, Optional
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from python.models import Customer
from python.services.store import store
from python.services.compliance import PythonComplianceService
from python.services.identity import identity_service
from python.services.policy import PythonPolicyEngine
from python.services.sms import payment_service
from python.services.agent_brain import agent_brain
from python.services.eval_runner import eval_runner

PORT = int(os.environ.get("PYTHON_PORT", 5000))
OPS_USER = os.environ.get("OPS_USER", "ops")
OPS_PASSWORD = os.environ.get("OPS_PASSWORD", "test")
SHARED_TOOL_SECRET = os.environ.get("SHARED_TOOL_SECRET", "nimbusflow-secure-secret-32-chars")

sessions: Dict[str, float] = {}

class NimbusFlowHTTPHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, status_code: int, data: Any, headers: Optional[Dict[str, str]] = None):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tool-secret, x-vapi-secret")
        if headers:
            for k, v in headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tool-secret, x-vapi-secret")
        self.end_headers()

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

    def _read_body_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def _has_valid_session(self) -> bool:
        cookie_header = self.headers.get("Cookie", "")
        for part in cookie_header.split(";"):
            part = part.strip()
            if part.startswith("ops_session="):
                token = part.split("=", 1)[1]
                if token in sessions:
                    return True
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # Serve Web UI at root /
        if path == "/" or path == "/index.html":
            tmpl_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
            if os.path.exists(tmpl_path):
                with open(tmpl_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # Serve Hosted SMS Payment Portal
        if path.startswith("/pay/"):
            link_id = path.split("/")[2]
            link = payment_service.links.get(link_id)
            cust = store.get_customer(link["customer_id"]) if link else None
            html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>NimbusFlow Hosted Checkout</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-4">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
    <div class="text-center mb-6">
      <div class="h-12 w-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-white text-xl mx-auto mb-2">N</div>
      <h2 class="text-lg font-bold">NimbusFlow Cloud Subscription Checkout</h2>
      <p class="text-xs text-slate-400">Secure 256-Bit SSL Encrypted Resolution</p>
    </div>
    {f'''
    <div class="p-4 rounded-xl bg-slate-950 border border-slate-800 mb-6 space-y-2 text-xs">
      <div class="flex justify-between"><span class="text-slate-400">Customer:</span><span class="font-bold">{cust.name if cust else "Valued Subscriber"}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Amount Due:</span><span class="text-cyan-400 font-bold text-sm">{link["currency"]} {link["amount"]}</span></div>
      <div class="flex justify-between"><span class="text-slate-400">Status:</span><span class="font-bold uppercase { "text-emerald-400" if link["status"] == "paid" else "text-amber-400" }">{link["status"]}</span></div>
    </div>
    <button onclick="payNow('{link_id}')" class="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 font-bold text-sm hover:opacity-90 transition-opacity">
      Pay Now via Instant UPI / Card
    </button>
    ''' if link else '<div class="text-rose-400 text-center py-4">Payment link is invalid or expired.</div>'}
    <div id="pay-res" class="mt-4 text-center text-xs"></div>
  </div>
  <script>
    async function payNow(id) {{
      const res = await fetch('/api/payments/pay', {{
        method: 'POST',
        headers: {{ 'Content-Type': 'application/json' }},
        body: JSON.stringify({{ linkId: id, paymentMethod: 'UPI' }})
      }});
      const data = await res.json();
      if (data.success) {{
        document.getElementById('pay-res').innerHTML = '<span class="text-emerald-400 font-bold">Payment Confirmed! Your subscription is active. Ava will acknowledge this on the call.</span>';
      }}
    }}
  </script>
</body>
</html>"""
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/healthz":
            return self._send_json(200, {"ok": True, "engine": "Python 3 Standard Library", "service": "NimbusFlow"})

        if path == "/api/auth/me":
            if self._has_valid_session():
                return self._send_json(200, {"authenticated": True, "user": OPS_USER})
            return self._send_json(200, {"authenticated": False})

        if path == "/api/customers":
            return self._send_json(200, store.get_customers_sanitized())

        if path.startswith("/api/customers/") and path.endswith("/pre-call"):
            cust_id = path.split("/")[3]
            cust = store.get_customer(cust_id)
            if not cust:
                return self._send_json(404, {"error": "Customer not found"})
            res = PythonComplianceService.evaluate_pre_call(cust)
            return self._send_json(200, {
                "canDial": res.can_dial,
                "reasons": res.reasons,
                "localTime": res.local_time_formatted,
                "withinTcpaWindow": res.within_tcpa_window,
                "dncActive": res.dnc_active,
                "callLimitReached": res.call_limit_reached,
                "consentGiven": res.consent_given
            })

        if path.startswith("/api/customers/"):
            cust_id = path.split("/")[3]
            cust = store.get_customer(cust_id)
            if not cust:
                return self._send_json(404, {"error": "Customer not found"})
            data = store.get_customers_sanitized()
            found = next((c for c in data if c["id"] == cust_id), None)
            return self._send_json(200, {"customer": found})

        if path == "/api/calls/events" or path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try:
                self.wfile.write(b"event: connected\ndata: {}\n\n")
                self.wfile.flush()
            except Exception:
                pass
            return

        if path == "/api/stats":
            customers = store.get_customers()
            return self._send_json(200, {
                "total_customers": len(customers),
                "unpaid_count": sum(1 for c in customers if c.amount_due > 0),
                "dnc_count": sum(1 for c in customers if c.dnc_flag),
                "hardship_count": sum(1 for c in customers if c.hardship_flag)
            })

        if path == "/api/audit-log":
            return self._send_json(200, store.audit_logs)

        return self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_body_json()

        if path == "/api/auth/login":
            username = body.get("username", "")
            password = body.get("password", "")
            if username == OPS_USER and password == OPS_PASSWORD:
                token = secrets.token_hex(32)
                sessions[token] = 1
                cookie = f"ops_session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800"
                return self._send_json(200, {"ok": True, "user": OPS_USER}, {"Set-Cookie": cookie})
            return self._send_json(401, {"error": "Invalid operator credentials."})

        if path == "/api/auth/logout":
            return self._send_json(200, {"ok": True}, {"Set-Cookie": "ops_session=; Path=/; Max-Age=0"})

        if path == "/api/evals/run":
            res = eval_runner.run_all_evals()
            return self._send_json(200, res)

        if path == "/api/payments/pay":
            link_id = body.get("linkId")
            res = payment_service.complete_payment(link_id, body.get("paymentMethod", "UPI"))
            if not res["success"]:
                return self._send_json(404, {"error": "Payment link not found or expired"})
            cust_id = res["link"]["customer_id"]
            store.update_customer(cust_id, {"amount_due": 0})
            return self._send_json(200, {"success": True, "status": "paid", "link": res["link"]})

        if path == "/api/customers":
            phone = str(body.get("phone", "")).strip()
            if any(c.phone == phone for c in store.get_customers()):
                return self._send_json(409, {"error": "Another customer already uses this phone number."})

            new_id = "cust_" + secrets.token_hex(4)
            cust = Customer(
                id=new_id,
                name=body.get("name", "New Customer"),
                phone=phone,
                email=body.get("email", ""),
                language=body.get("language", "en"),
                timezone=body.get("timezone", "Asia/Kolkata"),
                plan=body.get("plan", "NimbusFlow Standard"),
                amount_due=float(body.get("amount_due", 0)),
                currency=body.get("currency", "INR"),
                due_date=body.get("due_date", "2026-03-31"),
                last4=str(body.get("last4", "4242")),
                zip_code=str(body.get("zip_code", "560001")),
                failure_code=body.get("failure_code", "card_expired"),
                failure_reason=body.get("failure_reason", "Card expired"),
                payment_failures_count=1,
                call_attempts_count=0,
                tenure_months=12,
                segment=body.get("segment", "SMB"),
                consent_status=body.get("consent_status") is True,
                dnc_flag=bool(body.get("dnc_flag", False)),
                hardship_flag=bool(body.get("hardship_flag", False)),
                billing_hold=bool(body.get("billing_hold", False)),
                notes=body.get("notes", "Added via portal"),
                persona_scenario=body.get("persona_scenario", "expired_card_cooperative")
            )
            created = store.add_customer(cust)
            return self._send_json(201, {"customer": created.id, "name": created.name})

        if path == "/api/calls/dial":
            cust_id = body.get("customerId", "")
            cust = store.get_customer(cust_id)
            if not cust:
                return self._send_json(404, {"error": "Customer not found"})
            comp = PythonComplianceService.evaluate_pre_call(cust)
            if not comp.can_dial:
                return self._send_json(403, {"error": "; ".join(comp.reasons)})
            call_id = "call_" + secrets.token_hex(6)
            sess, greeting = agent_brain.start_call(cust, call_id)
            store.record_call_session(sess)
            cust.call_attempts_count += 1
            return self._send_json(200, {
                "callId": call_id,
                "status": "connected",
                "initialGreeting": greeting,
                "customer": {"name": cust.name, "phone": cust.phone, "plan": cust.plan}
            })

        if path == "/api/calls/chat":
            cust_id = body.get("customerId", "")
            call_id = body.get("callId", "")
            message = body.get("message", "")
            cust = store.get_customer(cust_id)
            sess = store.calls.get(call_id)
            if not cust or not sess:
                return self._send_json(404, {"error": "Active call or customer not found"})
            reply = agent_brain.process_turn(sess, cust, message)
            return self._send_json(200, {
                "callId": sess.id,
                "state": sess.state,
                "reply": reply,
                "factorVerified": sess.factor_verified,
                "outcome": sess.outcome
            })

        if path == "/api/calls/end":
            call_id = body.get("callId", "")
            sess = store.calls.get(call_id)
            if sess:
                sess.ended_at = "2026-10-02T11:05:00Z"
                sess.outcome = body.get("outcome", sess.outcome or "completed")
            return self._send_json(200, {"status": "ended"})

        if path == "/api/reset":
            store.reset_data()
            return self._send_json(200, {"status": "reset", "customersCount": len(store.get_customers())})

        # Vapi Tool Call Webhook
        if path == "/api/vapi/webhook" or path == "/api/tools/vapi-webhook":
            message = body.get("message", body)
            tool_calls = message.get("toolCallList") or message.get("toolCalls") or []
            call_phone = message.get("call", {}).get("customer", {}).get("number")
            provider_call_id = message.get("call", {}).get("id", "unknown_call")

            results = []
            for tc in tool_calls:
                func_name = tc.get("name") or tc.get("function", {}).get("name", "")
                tool_call_id = tc.get("id", "tc_1")
                args = tc.get("parameters") or tc.get("function", {}).get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except Exception:
                        args = {}

                # Strict customer resolution prioritizing called number
                cust = None
                if call_phone:
                    cust = next((c for c in store.get_customers() if c.phone == call_phone), None)
                if not cust and not call_phone:
                    arg_id = args.get("customerId") or args.get("customer_id")
                    if arg_id:
                        cust = store.get_customer(arg_id)

                is_verified = False
                if cust and provider_call_id:
                    sess = identity_service.get_session(provider_call_id)
                    if sess and sess.factor_verified and not sess.is_locked_out and sess.customer_id == cust.id:
                        is_verified = True

                res: Dict[str, Any] = {}
                if func_name == "verify_identity":
                    if not cust:
                        res = {"error": "Customer not found"}
                    else:
                        factor_type = args.get("factorType", "last4")
                        val = str(args.get("factorValue") or args.get("value") or "")
                        res = identity_service.verify_factor(provider_call_id, cust, factor_type, val)

                elif func_name in ("create_payment_link", "send_payment_link"):
                    if not cust:
                        res = {"error": "Customer not found"}
                    elif cust.dnc_flag:
                        res = {"error": "compliance_blocked", "message": "Customer on DNC list"}
                    elif not is_verified:
                        res = {"error": "identity_not_verified", "requiresVerification": True}
                    else:
                        link = payment_service.create_payment_link(cust.id, cust.amount_due, cust.currency)
                        res = {"success": True, "url": link["url"], "amount": cust.amount_due}

                elif func_name == "get_customer_context":
                    if not cust:
                        res = {"error": "Customer not found"}
                    elif not is_verified:
                        res = {"customerId": cust.id, "name": cust.name, "identityVerified": False, "note": "Verify identity before discussing account details."}
                    else:
                        pol = PythonPolicyEngine.get_policy(cust)
                        res = {"customerId": cust.id, "name": cust.name, "amountDue": cust.amount_due, "plan": cust.plan, "strategy": pol.strategy}

                elif func_name == "mark_do_not_call":
                    if cust:
                        store.mark_customer_dnc(cust.id)
                        res = {"success": True, "status": "dnc_applied"}
                    else:
                        res = {"error": "Customer not found"}

                elif func_name == "escalate_to_human":
                    if cust:
                        res = {"status": "escalated_to_supervisor", "customerId": cust.id}
                    else:
                        res = {"error": "Customer not found"}

                results.append({"name": func_name, "toolCallId": tool_call_id, "result": json.dumps(res)})

            return self._send_json(200, {"results": results})

        return self._send_json(404, {"error": "Not Found"})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_body_json()

        if path.startswith("/api/customers/"):
            cust_id = path.split("/")[3]
            existing = store.get_customer(cust_id)
            if not existing:
                return self._send_json(404, {"error": "Customer not found"})

            allowed = ["name", "phone", "email", "language", "timezone", "plan", "amount_due", "currency", "due_date", "last4", "zip_code", "failure_code", "failure_reason", "segment", "consent_status", "hardship_flag", "dnc_flag", "billing_hold", "notes"]
            patch = {k: v for k, v in body.items() if k in allowed}

            new_phone = patch.get("phone")
            if new_phone and any(c.id != cust_id and c.phone == str(new_phone).strip() for c in store.get_customers()):
                return self._send_json(409, {"error": "Another customer already uses this phone number."})

            updated = store.update_customer(cust_id, patch)
            return self._send_json(200, {"customer": cust_id, "status": "updated"})

        return self._send_json(404, {"error": "Not Found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/customers/"):
            cust_id = path.split("/")[3]
            deleted = store.delete_customer(cust_id)
            if deleted:
                return self._send_json(200, {"success": True, "message": f"Customer {cust_id} removed."})
            return self._send_json(404, {"error": "Customer not found"})
        return self._send_json(404, {"error": "Not Found"})

def run_server(port: int = PORT):
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    server = http.server.ThreadingHTTPServer(("0.0.0.0", port), NimbusFlowHTTPHandler)
    print(f"NimbusFlow Python Server running on http://0.0.0.0:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        server.server_close()

if __name__ == "__main__":
    run_server()
