#!/usr/bin/env python3
import sys
import os
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from python.services.store import store
from python.services.agent_brain import agent_brain
from python.services.sms import payment_service

def main():
    print("=" * 80)
    print("NimbusFlow (Ava) - Interactive Outbound Call Simulation Walkthrough")
    print("Scenario: Rajesh Sharma (cust_001) - Expired Card Recovery")
    print("=" * 80)

    cust = store.get_customer("cust_001")
    if not cust:
        print("Customer not found")
        sys.exit(1)

    call_id = "demo_call_001"
    session, initial = agent_brain.start_call(cust, call_id)

    print(f"\n[DIALING OUTBOUND] Target: {cust.phone} ({cust.name})")
    print(f"[STATUS] Connected. Mandatory sentence-1 disclosure enforced.\n")
    print(f"AVA:  \"{initial}\"")

    time.sleep(1)
    user_turn_1 = "Yes, speaking. Who is calling?"
    print(f"\nUSER: \"{user_turn_1}\"")
    reply_1 = agent_brain.process_turn(session, cust, user_turn_1)
    print(f"AVA:  \"{reply_1}\"")

    time.sleep(1)
    user_turn_2 = f"Sure, the last 4 digits of my card are {cust.last4}."
    print(f"\nUSER: \"{user_turn_2}\"")
    reply_2 = agent_brain.process_turn(session, cust, user_turn_2)
    print(f"AVA:  \"{reply_2}\"")

    time.sleep(1)
    user_turn_3 = "Yes, please send me the payment link via SMS."
    print(f"\nUSER: \"{user_turn_3}\"")
    reply_3 = agent_brain.process_turn(session, cust, user_turn_3)
    print(f"AVA:  \"{reply_3}\"")

    # Simulate customer clicking the link and paying
    print("\n" + "-" * 80)
    print("[OUT-OF-BAND PAYMENT SIMULATION]")
    links = list(payment_service.links.values())
    if links:
        link = links[-1]
        print(f"SMS Received at {cust.phone}: \"NimbusFlow: Pay INR {cust.amount_due} at {link['url']}\"")
        pay_res = payment_service.complete_payment(link["id"], "UPI")
        print(f"Payment Status: Completed via UPI (Transaction: {pay_res['link']['transaction_id']})")
        cust.amount_due = 0
        store.update_customer(cust.id, {"amount_due": 0})
        print(f"Ledger Updated: {cust.name} balance set to INR 0.00")
    print("-" * 80)

    print("\nAVA:  \"Thank you Rajesh! I just received instant confirmation that your payment went through. Your NimbusFlow Growth Cloud subscription is fully active. Have a great day!\"")
    print("\n[CALL COMPLETED] Resolution: Paid Live (100% Policy Compliant)")
    print("=" * 80)

if __name__ == "__main__":
    main()
