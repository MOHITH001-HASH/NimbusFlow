from datetime import datetime, timezone, timedelta
from python.models import Customer, ComplianceResult

class PythonComplianceService:
    @staticmethod
    def evaluate_pre_call(customer: Customer, override: bool = False) -> ComplianceResult:
        reasons = []
        
        # 1. Active Do-Not-Call flag
        dnc_active = customer.dnc_flag
        if dnc_active:
            reasons.append("Customer is on the regulatory Do-Not-Call (DNC) list.")

        # 2. Consent check
        consent_given = customer.consent_status is True
        if not consent_given:
            reasons.append("Customer has not provided affirmative consent for automated dialing.")

        # 3. Call attempt throttling (Max 3 calls per week)
        call_limit_reached = customer.call_attempts_count >= 3
        if call_limit_reached:
            reasons.append("Maximum permissible outreach frequency reached (3 attempts / 7 days).")

        # 4. TCPA 09:00 - 20:00 Calling Window (Fixed offset for Asia/Kolkata +05:30)
        now_utc = datetime.now(timezone.utc)
        ist_time = now_utc + timedelta(hours=5, minutes=30)
        hour = ist_time.hour
        local_time_str = ist_time.strftime("%I:%M %p IST")
        
        within_tcpa_window = 9 <= hour < 20
        if not within_tcpa_window:
            reasons.append(f"Outside permissible TCPA calling window (09:00 - 20:00). Current customer local time: {local_time_str}.")

        can_dial = (len(reasons) == 0) or override

        return ComplianceResult(
            can_dial=can_dial,
            reasons=reasons,
            local_time_formatted=local_time_str,
            within_tcpa_window=within_tcpa_window,
            dnc_active=dnc_active,
            call_limit_reached=call_limit_reached,
            consent_given=consent_given
        )
