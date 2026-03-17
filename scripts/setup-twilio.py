#!/usr/bin/env python3
"""
Twilio Setup & Test Script for River City Roofing Solutions
Run: python scripts/setup-twilio.py

Steps:
1. Sign up at https://www.twilio.com/try-twilio
2. Get Account SID + Auth Token from https://console.twilio.com
3. Get a phone number (trial gives you one free)
4. Run this script - it will configure .env.local and send a test SMS
"""

import os
import sys
import json
import base64
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError
from pathlib import Path

ENV_FILE = Path(__file__).parent.parent / ".env.local"

def get_input(prompt, default=""):
    val = input(f"{prompt} [{default}]: " if default else f"{prompt}: ").strip()
    return val or default

def update_env(key, value):
    """Update a key in .env.local"""
    content = ENV_FILE.read_text(encoding="utf-8")
    lines = content.split("\n")
    found = False
    for i, line in enumerate(lines):
        stripped = line.lstrip("# ")
        if stripped.startswith(f"{key}="):
            lines[i] = f'{key}="{value}"'
            found = True
            break
    if not found:
        lines.append(f'{key}="{value}"')
    ENV_FILE.write_text("\n".join(lines), encoding="utf-8")

def twilio_api(sid, token, endpoint, method="GET", data=None):
    """Make a Twilio API call"""
    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/{endpoint}"
    auth = base64.b64encode(f"{sid}:{token}".encode()).decode()
    headers = {"Authorization": f"Basic {auth}"}

    if data:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        body = urlencode(data).encode()
    else:
        body = None

    req = Request(url, data=body, headers=headers, method=method)
    try:
        resp = urlopen(req)
        return json.loads(resp.read().decode())
    except HTTPError as e:
        error_body = e.read().decode()
        try:
            return json.loads(error_body)
        except:
            return {"error": error_body, "status": e.code}

def main():
    print("=" * 60)
    print("  RCRS Twilio Setup")
    print("=" * 60)
    print()
    print("1. Sign up: https://www.twilio.com/try-twilio")
    print("2. Dashboard: https://console.twilio.com")
    print()

    # Get credentials
    sid = get_input("Account SID (starts with AC)")
    if not sid.startswith("AC"):
        print("Error: Account SID should start with 'AC'")
        sys.exit(1)

    token = get_input("Auth Token")
    if not token:
        print("Error: Auth Token is required")
        sys.exit(1)

    # Verify credentials
    print("\nVerifying credentials...")
    result = twilio_api(sid, token, ".json")
    if "sid" not in result:
        print(f"Error: Invalid credentials - {result}")
        sys.exit(1)

    account_name = result.get("friendly_name", "Unknown")
    print(f"  Account: {account_name}")
    print(f"  Status: {result.get('status', 'unknown')}")
    print(f"  Type: {result.get('type', 'unknown')}")

    # Check for existing phone numbers
    print("\nChecking phone numbers...")
    numbers = twilio_api(sid, token, "IncomingPhoneNumbers.json")

    phone = ""
    if numbers.get("incoming_phone_numbers"):
        print("  Existing numbers found:")
        for num in numbers["incoming_phone_numbers"]:
            print(f"    {num['phone_number']} ({num.get('friendly_name', '')})")
        phone = numbers["incoming_phone_numbers"][0]["phone_number"]
        print(f"\n  Using: {phone}")
    else:
        print("  No numbers found.")
        # Try to get available numbers
        print("  Searching for available 256 (Huntsville) numbers...")
        available = twilio_api(sid, token, "AvailablePhoneNumbers/US/Local.json?AreaCode=256&SmsEnabled=true&Limit=3")

        if available.get("available_phone_numbers"):
            print("  Available numbers:")
            for i, num in enumerate(available["available_phone_numbers"]):
                print(f"    {i+1}. {num['phone_number']} ({num.get('locality', '')}, {num.get('region', '')})")

            choice = get_input("\n  Buy which number? (1-3, or paste your own +1XXXXXXXXXX)", "1")
            if choice.startswith("+"):
                phone = choice
            else:
                idx = int(choice) - 1
                phone = available["available_phone_numbers"][idx]["phone_number"]

            # Buy the number
            print(f"\n  Purchasing {phone}...")
            buy_result = twilio_api(sid, token, "IncomingPhoneNumbers.json", "POST", {
                "PhoneNumber": phone,
                "FriendlyName": "RCRS SMS"
            })
            if buy_result.get("sid"):
                print(f"  Purchased! SID: {buy_result['sid']}")
            else:
                print(f"  Purchase failed: {buy_result}")
                phone = get_input("  Enter phone number manually (+1XXXXXXXXXX)")
        else:
            print("  No 256 numbers available. Trying any US number...")
            available = twilio_api(sid, token, "AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&Limit=3")
            if available.get("available_phone_numbers"):
                for i, num in enumerate(available["available_phone_numbers"]):
                    print(f"    {i+1}. {num['phone_number']} ({num.get('locality', '')}, {num.get('region', '')})")
                choice = get_input("\n  Buy which? (1-3)", "1")
                idx = int(choice) - 1
                phone = available["available_phone_numbers"][idx]["phone_number"]
                print(f"\n  Purchasing {phone}...")
                buy_result = twilio_api(sid, token, "IncomingPhoneNumbers.json", "POST", {
                    "PhoneNumber": phone,
                    "FriendlyName": "RCRS SMS"
                })
                if buy_result.get("sid"):
                    print(f"  Purchased! SID: {buy_result['sid']}")
                else:
                    print(f"  Failed: {buy_result}")
                    phone = get_input("  Enter number manually")
            else:
                phone = get_input("  Enter your Twilio phone number (+1XXXXXXXXXX)")

    if not phone:
        print("Error: No phone number configured")
        sys.exit(1)

    # Update .env.local
    print(f"\nUpdating .env.local...")
    update_env("TWILIO_ACCOUNT_SID", sid)
    update_env("TWILIO_AUTH_TOKEN", token)
    update_env("TWILIO_PHONE_NUMBER", phone)
    print("  .env.local updated!")

    # Send test SMS
    test_number = get_input("\nSend test SMS to (your cell, +1XXXXXXXXXX)")
    if test_number:
        print(f"  Sending test to {test_number}...")
        sms_result = twilio_api(sid, token, "Messages.json", "POST", {
            "To": test_number,
            "From": phone,
            "Body": "River City Roofing Solutions - SMS notifications are now active! This is a test from River Bot."
        })
        if sms_result.get("sid"):
            print(f"  Sent! Message SID: {sms_result['sid']}")
            print(f"  Status: {sms_result.get('status', 'unknown')}")
        else:
            print(f"  Failed: {sms_result}")
            if "trial" in str(sms_result).lower():
                print("\n  NOTE: Twilio trial accounts can only send to verified numbers.")
                print("  Verify your number at: https://console.twilio.com/us1/develop/phone-numbers/manage/verified")

    print("\n" + "=" * 60)
    print("  Setup complete!")
    print("=" * 60)
    print(f"\n  Account SID: {sid}")
    print(f"  Phone Number: {phone}")
    print(f"  Env file: {ENV_FILE}")
    print(f"\n  Restart your dev server to pick up the new env vars.")
    print(f"  SMS is now active for: portal links, delivery reminders,")
    print(f"  appointment reminders, and status updates.")

if __name__ == "__main__":
    main()
