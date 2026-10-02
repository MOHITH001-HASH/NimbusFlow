import json
import os
from dataclasses import asdict
from typing import List, Optional, Dict, Any
from python.models import Customer, CallSession

INITIAL_CUSTOMERS: List[Dict[str, Any]] = [
    {
        "id": "cust_001",
        "name": "Rajesh Sharma",
        "phone": "+15550100099",
        "email": "rajesh.sharma@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Growth Cloud",
        "amount_due": 2499,
        "currency": "INR",
        "due_date": "2026-03-28",
        "last4": "4242",
        "zip_code": "560001",
        "failure_code": "card_expired",
        "failure_reason": "Card expired at month-end",
        "payment_failures_count": 1,
        "call_attempts_count": 0,
        "tenure_months": 24,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Long-standing customer, prompt payer.",
        "persona_scenario": "expired_card_cooperative"
    },
    {
        "id": "cust_002",
        "name": "Priya Patel",
        "phone": "+15550100088",
        "email": "priya.patel@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Pro Annual",
        "amount_due": 4999,
        "currency": "INR",
        "due_date": "2026-03-29",
        "last4": "1122",
        "zip_code": "400001",
        "failure_code": "insufficient_funds",
        "failure_reason": "Temporary overdraft balance",
        "payment_failures_count": 2,
        "call_attempts_count": 1,
        "tenure_months": 14,
        "segment": "Enterprise",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Requested payroll date alignment.",
        "persona_scenario": "insufficient_funds_promise"
    },
    {
        "id": "cust_003",
        "name": "Amit Kumar",
        "phone": "+15550100077",
        "email": "amit.kumar@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Enterprise Cluster",
        "amount_due": 12500,
        "currency": "INR",
        "due_date": "2026-03-25",
        "last4": "5566",
        "zip_code": "110001",
        "failure_code": "fraud_security_trigger",
        "failure_reason": "Bank automated fraud hold",
        "payment_failures_count": 1,
        "call_attempts_count": 0,
        "tenure_months": 36,
        "segment": "Enterprise",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Bank SMS required before reattempt.",
        "persona_scenario": "bank_fraud_block"
    },
    {
        "id": "cust_004",
        "name": "Sunita Rao",
        "phone": "+15550100066",
        "email": "sunita.rao@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Creative Suite",
        "amount_due": 1899,
        "currency": "INR",
        "due_date": "2026-03-26",
        "last4": "7788",
        "zip_code": "500001",
        "failure_code": "disputed_charge",
        "failure_reason": "Customer disputes add-on fees",
        "payment_failures_count": 1,
        "call_attempts_count": 0,
        "tenure_months": 6,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Questioning bandwidth overage charges.",
        "persona_scenario": "disputes_charge"
    },
    {
        "id": "cust_005",
        "name": "Vikram Singh",
        "phone": "+15550100055",
        "email": "vikram.singh@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Fleet Pro",
        "amount_due": 6200,
        "currency": "INR",
        "due_date": "2026-03-27",
        "last4": "9900",
        "zip_code": "600001",
        "failure_code": "card_declined_generic",
        "failure_reason": "Generic issuer decline",
        "payment_failures_count": 1,
        "call_attempts_count": 0,
        "tenure_months": 18,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Wrong person answered on previous call.",
        "persona_scenario": "wrong_person"
    },
    {
        "id": "cust_006",
        "name": "Ananya Desai",
        "phone": "+15550100044",
        "email": "ananya.desai@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Professional",
        "amount_due": 8500,
        "currency": "INR",
        "due_date": "2026-03-20",
        "last4": "3344",
        "zip_code": "380001",
        "failure_code": "insufficient_funds",
        "failure_reason": "Temporary cash flow constraint",
        "payment_failures_count": 3,
        "call_attempts_count": 2,
        "tenure_months": 8,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": True,
        "billing_hold": False,
        "notes": "Eligible for 3-month installment relief plan.",
        "persona_scenario": "hardship_needing_plan"
    },
    {
        "id": "cust_007",
        "name": "Rahul Verma",
        "phone": "+15550100033",
        "email": "rahul.verma@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Starter Team",
        "amount_due": 3200,
        "currency": "INR",
        "due_date": "2026-03-29",
        "last4": "2233",
        "zip_code": "700001",
        "failure_code": "payment_timeout",
        "failure_reason": "Payment gateway timeout",
        "payment_failures_count": 1,
        "call_attempts_count": 0,
        "tenure_months": 4,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Hostile tone reported on earlier ticket.",
        "persona_scenario": "angry_customer"
    },
    {
        "id": "cust_008",
        "name": "Sunita Gupta",
        "phone": "+15550100022",
        "email": "sunita.gupta@example.in",
        "language": "hi",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Retail POS",
        "amount_due": 1599,
        "currency": "INR",
        "due_date": "2026-03-30",
        "last4": "6677",
        "zip_code": "201301",
        "failure_code": "card_expired",
        "failure_reason": "Card expired",
        "payment_failures_count": 1,
        "call_attempts_count": 0,
        "tenure_months": 15,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Hindi language preference specified.",
        "persona_scenario": "hindi_speaker"
    },
    {
        "id": "cust_009",
        "name": "Deepak Joshi",
        "phone": "+15550100011",
        "email": "deepak.joshi@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Legal Suite",
        "amount_due": 2100,
        "currency": "INR",
        "due_date": "2026-03-22",
        "last4": "8899",
        "zip_code": "302001",
        "failure_code": "dnc_request",
        "failure_reason": "Customer opted out of calls",
        "payment_failures_count": 1,
        "call_attempts_count": 1,
        "tenure_months": 22,
        "segment": "SMB",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "Expects instant DNC honoring.",
        "persona_scenario": "do_not_call"
    },
    {
        "id": "cust_010",
        "name": "Siddharth Rao",
        "phone": "+15550100000",
        "email": "siddharth.rao@example.in",
        "language": "en",
        "timezone": "Asia/Kolkata",
        "plan": "NimbusFlow Enterprise Dedicated",
        "amount_due": 25000,
        "currency": "INR",
        "due_date": "2026-03-15",
        "last4": "9988",
        "zip_code": "560025",
        "failure_code": "billing_dispute_vip",
        "failure_reason": "Enterprise SLA renegotiation",
        "payment_failures_count": 2,
        "call_attempts_count": 0,
        "tenure_months": 48,
        "segment": "Enterprise",
        "consent_status": True,
        "dnc_flag": False,
        "hardship_flag": False,
        "billing_hold": False,
        "notes": "VIP account requiring executive account director transfer.",
        "persona_scenario": "vip_closed_account"
    }
]

class PythonStore:
    def __init__(self, db_path: str = "autopay_db.json"):
        self.db_path = db_path
        self.customers: Dict[str, Customer] = {}
        self.calls: Dict[str, CallSession] = {}
        self.audit_logs: List[Dict[str, Any]] = []
        self._load()

    def _load(self):
        for raw in INITIAL_CUSTOMERS:
            self.customers[raw["id"]] = Customer(**raw)

    def get_customers(self) -> List[Customer]:
        return list(self.customers.values())

    def get_customers_sanitized(self) -> List[Dict[str, Any]]:
        result = []
        for c in self.customers.values():
            d = asdict(c)
            last4 = d.pop("last4", "")
            d.pop("zip_code", "")
            d["last4_masked"] = f"•••• {last4}"
            result.append(d)
        return result

    def get_customer(self, customer_id: str) -> Optional[Customer]:
        return self.customers.get(customer_id)

    def add_customer(self, customer: Customer) -> Customer:
        self.customers[customer.id] = customer
        return customer

    def update_customer(self, customer_id: str, patch: Dict[str, Any]) -> Optional[Customer]:
        cust = self.customers.get(customer_id)
        if not cust:
            return None
        for k, v in patch.items():
            if hasattr(cust, k):
                setattr(cust, k, v)
        return cust

    def delete_customer(self, customer_id: str) -> bool:
        if customer_id in self.customers:
            del self.customers[customer_id]
            return True
        return False

    def mark_customer_dnc(self, customer_id: str) -> bool:
        cust = self.customers.get(customer_id)
        if cust:
            cust.dnc_flag = True
            cust.consent_status = False
            self.log_audit("dnc_recorded", {"customer_id": customer_id})
            return True
        return False

    def log_audit(self, event_type: str, details: Dict[str, Any]):
        self.audit_logs.append({
            "timestamp": "2026-10-02T11:00:00Z",
            "event_type": event_type,
            "details": details
        })

    def record_call_session(self, session: CallSession):
        self.calls[session.id] = session

    def get_call_history_for_customer(self, customer_id: str) -> List[CallSession]:
        return [c for c in self.calls.values() if c.customer_id == customer_id]

    def reset_data(self):
        self.customers.clear()
        self.calls.clear()
        self.audit_logs.clear()
        self._load()

store = PythonStore()
