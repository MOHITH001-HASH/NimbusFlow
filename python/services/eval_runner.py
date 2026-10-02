from typing import List, Dict, Any
from python.services.store import store
from python.services.agent_brain import agent_brain
from python.services.compliance import PythonComplianceService

class PythonEvalRunner:
    @staticmethod
    def run_all_evals() -> Dict[str, Any]:
        results = []
        pass_count = 0
        total = 0

        # Test script simulation for each persona
        persona_scripts = {
            "cust_001": ["Yes, speaking.", "4242", "Yes, please send the link."],
            "cust_002": ["This is Priya.", "1122", "I get paid Friday, can I pay Friday?"],
            "cust_003": ["Speaking.", "5566", "My bank flagged it, I'll pay on Friday."],
            "cust_004": ["Yes, this is Sunita.", "7788", "I dispute this extra bandwidth fee! Transfer me."],
            "cust_005": ["Wrong number, Vikram doesn't live here."],
            "cust_006": ["Yes, Ananya here.", "3344", "I have financial hardship right now. Can I do installment?"],
            "cust_007": ["Yes Rahul here.", "2233", "Your system is ridiculous! I want to speak to a manager."],
            "cust_008": ["हाँ, मैं सुनीता बोल रही हूँ।", "6677", "हाँ लिंक भेज दीजिये।"],
            "cust_009": ["Put me on your Do Not Call list right now."],
            "cust_010": ["Yes Siddharth Rao speaking.", "9988", "We cancelled our enterprise contract. Transfer me to legal."]
        }

        expected_outcomes = {
            "cust_001": "paid_live",
            "cust_002": "promise_to_pay",
            "cust_003": "promise_to_pay",
            "cust_004": "escalated_to_human",
            "cust_005": "wrong_person",
            "cust_006": "payment_plan_agreed",
            "cust_007": "escalated_to_human",
            "cust_008": "paid_live",
            "cust_009": "do_not_call",
            "cust_010": "escalated_to_human"
        }

        customers = store.get_customers()

        for cust in customers:
            total += 1
            call_id = f"eval_call_{cust.id}"
            session, initial = agent_brain.start_call(cust, call_id)

            # Check sentence 1 AI disclosure
            has_disclosure = "automated assistant" in initial.lower() or "ऑटोमेटेड" in initial

            # Execute turns
            script = persona_scripts.get(cust.id, ["Yes", cust.last4])
            for turn in script:
                agent_brain.process_turn(session, cust, turn)

            expected = expected_outcomes.get(cust.id, "paid_live")
            actual = session.outcome or "unknown"
            passed = (actual == expected) and has_disclosure

            if passed:
                pass_count += 1

            results.append({
                "customerId": cust.id,
                "name": cust.name,
                "scenario": cust.persona_scenario,
                "expectedOutcome": expected,
                "actualOutcome": actual,
                "disclosurePassed": has_disclosure,
                "passed": passed
            })

        compliance_rate = round((pass_count / total) * 100, 1) if total else 0.0

        return {
            "totalPersonas": total,
            "passedPersonas": pass_count,
            "complianceScore": compliance_rate,
            "overallStatus": "PASSED" if pass_count == total else "FAILED",
            "results": results
        }

eval_runner = PythonEvalRunner()
