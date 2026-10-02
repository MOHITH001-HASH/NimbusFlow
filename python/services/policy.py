from python.models import Customer, PolicyResult

class PythonPolicyEngine:
    @staticmethod
    def get_policy(customer: Customer) -> PolicyResult:
        if customer.hardship_flag:
            split_amount = round(customer.amount_due / 3, 2)
            return PolicyResult(
                strategy="hardship_installment_relief",
                recommended_action="offer_payment_plan",
                offer_ladder=[
                    f"3-Month Split Installment Plan: {customer.currency} {split_amount}/month",
                    "Grace period extension to upcoming month-end"
                ],
                rationale="Customer flagged for temporary financial hardship. Standard full recovery superseded by structured relief."
            )

        scenario = customer.persona_scenario

        if scenario == "expired_card_cooperative":
            return PolicyResult(
                strategy="immediate_card_update",
                recommended_action="send_payment_link",
                offer_ladder=["Direct encrypted SMS checkout link", "Alternative UPI / NetBanking checkout"],
                rationale="Payment failed due to card expiration. Customer has cooperative history."
            )
        elif scenario == "insufficient_funds_promise":
            return PolicyResult(
                strategy="promise_to_pay_schedule",
                recommended_action="schedule_promise_to_pay",
                offer_ladder=["Promise-to-pay for upcoming Friday (Salary Date)", "48-hour payment grace period"],
                rationale="Temporary liquidity constraint. Secure binding commitment date aligned with payroll."
            )
        elif scenario == "bank_fraud_block":
            return PolicyResult(
                strategy="security_unblock_and_reschedule",
                recommended_action="schedule_promise_to_pay",
                offer_ladder=["Bank security clearance grace period (24 hours)", "Automated payment reattempt on Friday"],
                rationale="Issuer automated fraud detection trigger. Requires customer confirmation with issuing bank."
            )
        elif scenario in ("disputes_charge", "angry_customer", "vip_closed_account"):
            return PolicyResult(
                strategy="immediate_human_escalation",
                recommended_action="escalate_to_human",
                offer_ladder=["Warm transfer to senior billing resolution supervisor"],
                rationale="Account dispute or heightened frustration requires live specialist intervention per SLA."
            )
        elif scenario == "do_not_call":
            return PolicyResult(
                strategy="instant_dnc_compliance",
                recommended_action="mark_do_not_call",
                offer_ladder=["Immediate cessation of telephone dunning outreach"],
                rationale="Statutory consumer opt-out must be honored immediately without objection."
            )
        elif scenario == "wrong_person":
            return PolicyResult(
                strategy="safe_wrong_person_exit",
                recommended_action="escalate_to_human",
                offer_ladder=["Polite call conclusion with zero balance or debt disclosure"],
                rationale="Third-party privacy protection prevents disclosing any billing details to unverified answerer."
            )
        else:
            return PolicyResult(
                strategy="standard_payment_link",
                recommended_action="send_payment_link",
                offer_ladder=["Direct encrypted SMS checkout link"],
                rationale="Standard payment failure recovery."
            )
