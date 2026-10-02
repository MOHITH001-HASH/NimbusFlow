import uuid
import secrets
from typing import Dict, Any

class PythonPaymentService:
    def __init__(self):
        self.links: Dict[str, Dict[str, Any]] = {}

    def create_payment_link(self, customer_id: str, amount: float, currency: str) -> Dict[str, Any]:
        link_id = "lnk_" + secrets.token_hex(4)
        token = secrets.token_urlsafe(16)
        url = f"https://nimbusflow.app/pay/{link_id}?token={token}"
        link = {
            "id": link_id,
            "customer_id": customer_id,
            "amount": amount,
            "currency": currency,
            "url": url,
            "status": "pending",
            "created_at": "2026-10-02T11:00:00Z"
        }
        self.links[link_id] = link
        return link

    def complete_payment(self, link_id: str, method: str = "UPI") -> Dict[str, Any]:
        link = self.links.get(link_id)
        if not link:
            return {"success": False, "error": "Link not found"}
        link["status"] = "paid"
        link["paid_at"] = "2026-10-02T11:01:00Z"
        link["transaction_id"] = "txn_" + secrets.token_hex(6)
        return {"success": True, "link": link}

payment_service = PythonPaymentService()
