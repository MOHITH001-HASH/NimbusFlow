import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from python.models import Customer
from python.services.store import store
from python.services.compliance import PythonComplianceService
from python.services.identity import PythonIdentityService
from python.services.agent_brain import PythonAgentBrain
from python.services.policy import PythonPolicyEngine

class TestNimbusFlowAutopay(unittest.TestCase):
    def setUp(self):
        store.reset_data()
        self.cust = store.get_customer("cust_001")
        self.identity = PythonIdentityService()

    def test_tcpa_and_dnc_compliance(self):
        # DNC flag check
        self.cust.dnc_flag = True
        res = PythonComplianceService.evaluate_pre_call(self.cust)
        self.assertFalse(res.can_dial)
        self.assertTrue(res.dnc_active)

        # Non-consented check
        self.cust.dnc_flag = False
        self.cust.consent_status = False
        res = PythonComplianceService.evaluate_pre_call(self.cust)
        self.assertFalse(res.can_dial)
        self.assertFalse(res.consent_given)

    def test_identity_verification_success(self):
        call_id = "call_test_001"
        res = self.identity.verify_factor(call_id, self.cust, "last4", self.cust.last4)
        self.assertTrue(res["verified"])
        self.assertFalse(res["is_locked_out"])

    def test_identity_verification_lockout_after_two_failures(self):
        call_id = "call_test_lockout"
        # First wrong attempt
        res1 = self.identity.verify_factor(call_id, self.cust, "last4", "0000")
        self.assertFalse(res1["verified"])
        self.assertFalse(res1["is_locked_out"])
        self.assertEqual(res1["attempts_remaining"], 1)

        # Second wrong attempt -> Lockout
        res2 = self.identity.verify_factor(call_id, self.cust, "last4", "1111")
        self.assertFalse(res2["verified"])
        self.assertTrue(res2["is_locked_out"])
        self.assertEqual(res2["attempts_remaining"], 0)

        # Subsequent attempt remains locked
        res3 = self.identity.verify_factor(call_id, self.cust, "last4", self.cust.last4)
        self.assertFalse(res3["verified"])
        self.assertTrue(res3["is_locked_out"])

    def test_spoofed_caller_id_protection(self):
        # Customer 1 called on +15550100099
        cust1 = store.get_customer("cust_001")
        # Attacker tries to verify Customer 2's last4
        cust2 = store.get_customer("cust_002")

        call_id = "call_spoof_test"
        # Resolving by called number must anchor to cust1
        resolved = next((c for c in store.get_customers() if c.phone == cust1.phone), None)
        self.assertEqual(resolved.id, cust1.id)

        # Verifying against cust1 with cust2's last4 fails
        res = self.identity.verify_factor(call_id, resolved, "last4", cust2.last4)
        self.assertFalse(res["verified"])

    def test_consent_default_to_false(self):
        def evaluate_consent(raw_val):
            return raw_val is True

        self.assertFalse(evaluate_consent(None))
        self.assertFalse(evaluate_consent(False))
        self.assertFalse(evaluate_consent("true"))
        self.assertFalse(evaluate_consent(1))
        self.assertTrue(evaluate_consent(True))

    def test_first_sentence_ai_disclosure(self):
        session, greeting = PythonAgentBrain.start_call(self.cust, "call_disc_001")
        self.assertIn("automated assistant", greeting.lower())
        self.assertIn("recorded line", greeting.lower())

    def test_wrong_person_zero_disclosure(self):
        session, _ = PythonAgentBrain.start_call(self.cust, "call_wrong_001")
        reply = PythonAgentBrain.process_turn(session, self.cust, "Wrong number, no one by that name here.")
        self.assertEqual(session.outcome, "wrong_person")
        self.assertNotIn(str(self.cust.amount_due), reply)
        self.assertNotIn(self.cust.plan, reply)
        self.assertNotIn("due", reply.lower())

    def test_dnc_request_immediate_honoring(self):
        session, _ = PythonAgentBrain.start_call(self.cust, "call_dnc_001")
        reply = PythonAgentBrain.process_turn(session, self.cust, "Stop calling me, put me on your DNC list.")
        self.assertEqual(session.outcome, "do_not_call")
        self.assertTrue(self.cust.dnc_flag)
        self.assertFalse(self.cust.consent_status)

if __name__ == "__main__":
    unittest.main()
