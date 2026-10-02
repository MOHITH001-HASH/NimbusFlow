from typing import Dict, Optional, Tuple
from python.models import Customer, IdentitySession

class PythonIdentityService:
    def __init__(self):
        self.sessions: Dict[str, IdentitySession] = {}

    def get_session(self, provider_call_id: str) -> Optional[IdentitySession]:
        return self.sessions.get(provider_call_id)

    def initialize_session(self, provider_call_id: str, customer_id: str) -> IdentitySession:
        session = IdentitySession(provider_call_id=provider_call_id, customer_id=customer_id)
        self.sessions[provider_call_id] = session
        return session

    def verify_factor(
        self, provider_call_id: str, customer: Customer, factor_type: str, factor_value: str
    ) -> Dict[str, any]:
        session = self.get_session(provider_call_id)
        if not session:
            session = self.initialize_session(provider_call_id, customer.id)

        if session.is_locked_out:
            return {
                "verified": False,
                "is_locked_out": True,
                "attempts_remaining": 0,
                "error": "Account verification locked out due to multiple failed attempts."
            }

        cleaned = str(factor_value).strip().replace(" ", "")
        is_match = False

        if factor_type == "last4":
            is_match = (cleaned == str(customer.last4).strip())
        elif factor_type == "zip":
            is_match = (cleaned == str(customer.zip_code).strip())

        if is_match:
            session.factor_verified = True
            return {
                "verified": True,
                "factor_type": factor_type,
                "is_locked_out": False,
                "attempts_remaining": max(0, 2 - session.failed_attempts)
            }
        else:
            session.failed_attempts += 1
            if session.failed_attempts >= 2:
                session.is_locked_out = True
                return {
                    "verified": False,
                    "is_locked_out": True,
                    "attempts_remaining": 0,
                    "error": "Authentication failed. Maximum verification attempts exceeded. Session locked out."
                }
            return {
                "verified": False,
                "is_locked_out": False,
                "attempts_remaining": 2 - session.failed_attempts,
                "error": "Authentication factor does not match records."
            }

identity_service = PythonIdentityService()
