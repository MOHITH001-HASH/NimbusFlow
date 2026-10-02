from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime

@dataclass
class Customer:
    id: str
    name: str
    phone: str
    email: str
    language: str
    timezone: str
    plan: str
    amount_due: float
    currency: str
    due_date: str
    last4: str
    zip_code: str
    failure_code: str
    failure_reason: str
    payment_failures_count: int
    call_attempts_count: int
    tenure_months: int
    segment: str
    consent_status: bool
    dnc_flag: bool
    hardship_flag: bool
    billing_hold: bool
    notes: str
    persona_scenario: str
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

@dataclass
class CallSession:
    id: str
    customer_id: str
    state: str
    started_at: str
    transcript: List[Dict[str, str]] = field(default_factory=list)
    factor_verified: bool = False
    verification_attempts: int = 0
    verification_locked: bool = False
    ended_at: Optional[str] = None
    outcome: Optional[str] = None

@dataclass
class IdentitySession:
    provider_call_id: str
    customer_id: str
    factor_verified: bool = False
    failed_attempts: int = 0
    is_locked_out: bool = False
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")

@dataclass
class ComplianceResult:
    can_dial: bool
    reasons: List[str]
    local_time_formatted: str
    within_tcpa_window: bool
    dnc_active: bool
    call_limit_reached: bool
    consent_given: bool

@dataclass
class PolicyResult:
    strategy: str
    recommended_action: str
    offer_ladder: List[str]
    rationale: str
