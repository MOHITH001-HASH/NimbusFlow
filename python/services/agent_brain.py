from typing import Dict, Any, Tuple
from python.models import Customer, CallSession
from python.services.policy import PythonPolicyEngine
from python.services.identity import identity_service
from python.services.sms import payment_service

class PythonAgentBrain:
    @staticmethod
    def start_call(customer: Customer, call_id: str) -> Tuple[CallSession, str]:
        session = CallSession(
            id=call_id,
            customer_id=customer.id,
            state="AWAITING_IDENTITY_CONFIRMATION",
            started_at="2026-10-02T11:00:00Z"
        )
        identity_service.initialize_session(call_id, customer.id)

        # Mandatory AI disclosure in first sentence
        if customer.language == "hi":
            initial_message = (
                f"नमस्ते, मैं NimbusFlow से Ava बोल रही हूँ, यह एक ऑटोमेटेड अस्सिटेंट है और यह कॉल रिकॉर्ड की जा रही है। "
                f"क्या मेरी बात {customer.name} जी से हो रही है?"
            )
        else:
            initial_message = (
                f"Hello, this is Ava calling from NimbusFlow on a recorded line using an automated assistant. "
                f"Am I speaking with {customer.name}?"
            )

        session.transcript.append({"role": "assistant", "content": initial_message})
        return session, initial_message

    @staticmethod
    def process_turn(session: CallSession, customer: Customer, user_text: str) -> str:
        text_lower = user_text.lower().strip()
        session.transcript.append({"role": "user", "content": user_text})

        # 1. Do Not Call check
        if any(w in text_lower for w in ["do not call", "stop calling", "remove my number", "dnc", "don't call"]):
            customer.dnc_flag = True
            customer.consent_status = False
            session.state = "DNC_TERMINATED"
            session.outcome = "do_not_call"
            reply = "I understand completely. I have added your number to our Do-Not-Call list immediately. You will not receive further calls from us. Have a good day."
            session.transcript.append({"role": "assistant", "content": reply})
            return reply

        # 2. Wrong Person check
        if any(w in text_lower for w in ["wrong number", "not me", "no such person", "who is this", "wrong person"]):
            session.state = "WRONG_PERSON_EXIT"
            session.outcome = "wrong_person"
            reply = "I apologize for the misunderstanding. I will update our records to prevent future calls to this number. Thank you for your time."
            session.transcript.append({"role": "assistant", "content": reply})
            return reply

        # 3. Identity Verification Gate
        if not session.factor_verified:
            # Check if user provided digits (last 4 or zip)
            digits = "".join(filter(str.isdigit, user_text))
            if digits:
                factor_type = "last4" if len(digits) == 4 else "zip"
                res = identity_service.verify_factor(session.id, customer, factor_type, digits)
                if res["verified"]:
                    session.factor_verified = True
                    policy = PythonPolicyEngine.get_policy(customer)
                    session.state = "OFFER_PRESENTED"
                    reply = (
                        f"Thank you for confirming your identity, {customer.name}. "
                        f"I'm calling because your recent subscription payment of {customer.currency} {customer.amount_due:,.2f} "
                        f"for {customer.plan} could not be processed due to: {customer.failure_reason}. "
                        f"We would love to help get this resolved today. "
                    )
                    if policy.recommended_action == "send_payment_link":
                        link = payment_service.create_payment_link(customer.id, customer.amount_due, customer.currency)
                        reply += f"I can send an encrypted checkout link directly to your mobile phone right now. Would you like me to send that over?"
                    elif policy.recommended_action == "offer_payment_plan":
                        reply += f"Given your situation, we can offer a 3-month split installment plan of {customer.currency} {round(customer.amount_due/3, 2):,.2f} per month to keep your services uninterrupted. Does that work for you?"
                    elif policy.recommended_action == "schedule_promise_to_pay":
                        reply += f"We can also schedule a commitment for payment on this Friday once your funds are cleared. Would Friday work best?"
                    elif policy.recommended_action == "escalate_to_human":
                        session.state = "ESCALATED"
                        session.outcome = "escalated_to_human"
                        reply += f"Since this involves a specialized billing question, let me immediately transfer you to our senior account supervisor."
                    session.transcript.append({"role": "assistant", "content": reply})
                    return reply
                else:
                    if res["is_locked_out"]:
                        session.verification_locked = True
                        session.state = "LOCKED_OUT"
                        session.outcome = "failed_verification"
                        reply = "For your privacy and security, we cannot continue without successful identity verification. Please visit nimbusflow.com/billing to update your account securely. Goodbye."
                        session.transcript.append({"role": "assistant", "content": reply})
                        return reply
                    else:
                        reply = f"That factor does not match our records. You have {res['attempts_remaining']} attempt remaining. Could you please state the last 4 digits of your payment card?"
                        session.transcript.append({"role": "assistant", "content": reply})
                        return reply
            else:
                # Ask for factor
                reply = f"Yes, before we discuss your account details, could you please verify the last 4 digits of the card on file or your billing postal code for security?"
                session.transcript.append({"role": "assistant", "content": reply})
                return reply

        # 4. In-Call Resolution Negotiations
        if any(w in text_lower for w in ["friday", "promise", "later", "schedule"]):
            session.state = "PROMISE_SCHEDULED"
            session.outcome = "promise_to_pay"
            reply = f"Understood. I have recorded a formal Promise-to-Pay for Friday for {customer.currency} {customer.amount_due:,.2f}. Thank you for confirming!"
            session.transcript.append({"role": "assistant", "content": reply})
            return reply

        if any(w in text_lower for w in ["installment", "plan", "split", "hardship"]):
            session.state = "PLAN_AGREED"
            session.outcome = "payment_plan_agreed"
            reply = f"Wonderful. I have enrolled your account into our 3-month installment plan at {customer.currency} {round(customer.amount_due/3, 2):,.2f} per month."
            session.transcript.append({"role": "assistant", "content": reply})
            return reply

        if any(w in text_lower for w in ["dispute", "manager", "human", "supervisor", "angry", "unfair", "legal", "cancelled"]):
            session.state = "ESCALATED"
            session.outcome = "escalated_to_human"
            reply = "I understand your concern. I am transferring you directly to a senior billing specialist right now to ensure this is addressed promptly."
            session.transcript.append({"role": "assistant", "content": reply})
            return reply

        if any(w in text_lower for w in ["yes", "send", "link", "sms", "pay", "हाँ", "लिंक", "भेज"]):
            link = payment_service.create_payment_link(customer.id, customer.amount_due, customer.currency)
            session.state = "AWAITING_PAYMENT"
            session.outcome = "paid_live"
            reply = f"Perfect! I have dispatched the encrypted payment link via SMS to {customer.phone}. Please open the link to complete payment securely."
            session.transcript.append({"role": "assistant", "content": reply})
            return reply

        reply = "Thank you for confirming. Is there anything else regarding your NimbusFlow account I can assist with today?"
        session.transcript.append({"role": "assistant", "content": reply})
        return reply

agent_brain = PythonAgentBrain()
