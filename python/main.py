#!/usr/bin/env python3
"""
NimbusFlow Autonomous AutoPay Recovery Voice Agent (Ava)
Pure Python 3.10+ Full-Stack Implementation
"""
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from python.app import run_server, PORT

def main():
    print("=" * 80)
    print("  NimbusFlow Autonomous Voice Recovery Agent (Ava) - Pure Python Edition")
    print("=" * 80)
    print(f"  • Web Console:           http://localhost:{PORT}")
    print(f"  • Default Credentials:   ops / test")
    print(f"  • Pre-seeded Accounts:   10 Canonical Personas (cust_001 to cust_010)")
    print(f"  • Out-of-Band Portal:    http://localhost:{PORT}/pay/<link_id>")
    print(f"  • Evaluation Runner:     python3 python/evals/run_evals.py")
    print(f"  • Interactive CLI Demo:  python3 python/evals/run_demo.py")
    print(f"  • Automated Unit Tests:  python3 python/tests/test_autopay.py")
    print("=" * 80)
    print(f"Starting Python HTTP server on port {PORT}...")
    run_server(PORT)

if __name__ == "__main__":
    main()
