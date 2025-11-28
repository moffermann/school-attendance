#!/usr/bin/env python3
"""
WhatsApp Business API Setup and Validation Script.

This script helps validate your WhatsApp Business API configuration
and send test messages to verify the setup is working correctly.

Usage:
    python scripts/whatsapp_setup.py --validate
    python scripts/whatsapp_setup.py --test-message +56912345678
    python scripts/whatsapp_setup.py --test-image +56912345678 https://example.com/image.jpg
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path

# Add app to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from dotenv import load_dotenv

load_dotenv()


class WhatsAppSetup:
    """WhatsApp Business API setup and validation utility."""

    def __init__(self):
        self.access_token = os.getenv("WHATSAPP_ACCESS_TOKEN", "")
        self.phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        self.enable_real = os.getenv("ENABLE_REAL_NOTIFICATIONS", "false").lower() == "true"
        self.base_url = f"https://graph.facebook.com/v17.0/{self.phone_number_id}"

    def validate_config(self) -> bool:
        """Validate that all required environment variables are set."""
        print("=" * 60)
        print("WhatsApp Business API Configuration Validation")
        print("=" * 60)

        errors = []

        # Check access token
        if not self.access_token:
            errors.append("WHATSAPP_ACCESS_TOKEN is not set")
            print("[ ] WHATSAPP_ACCESS_TOKEN: Not configured")
        elif len(self.access_token) < 50:
            errors.append("WHATSAPP_ACCESS_TOKEN seems too short")
            print("[?] WHATSAPP_ACCESS_TOKEN: Configured but seems short")
        else:
            print(f"[x] WHATSAPP_ACCESS_TOKEN: Configured ({len(self.access_token)} chars)")

        # Check phone number ID
        if not self.phone_number_id:
            errors.append("WHATSAPP_PHONE_NUMBER_ID is not set")
            print("[ ] WHATSAPP_PHONE_NUMBER_ID: Not configured")
        else:
            print(f"[x] WHATSAPP_PHONE_NUMBER_ID: {self.phone_number_id}")

        # Check real notifications flag
        print(f"[{'x' if self.enable_real else ' '}] ENABLE_REAL_NOTIFICATIONS: {self.enable_real}")
        if not self.enable_real:
            print("    Note: Messages will be logged but not sent (dry-run mode)")

        print("-" * 60)

        if errors:
            print("Errors found:")
            for error in errors:
                print(f"  - {error}")
            return False

        print("Configuration looks good!")
        return True

    async def verify_api_access(self) -> bool:
        """Verify API access by checking the phone number details."""
        print("\nVerifying API access...")

        if not self.access_token or not self.phone_number_id:
            print("Cannot verify: missing credentials")
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    self.base_url,
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )

                if response.status_code == 200:
                    data = response.json()
                    print(f"[x] API access verified!")
                    print(f"    Phone Number: {data.get('display_phone_number', 'N/A')}")
                    print(f"    Quality Rating: {data.get('quality_rating', 'N/A')}")
                    print(f"    Status: {data.get('status', 'N/A')}")
                    return True
                else:
                    print(f"[ ] API access failed: {response.status_code}")
                    print(f"    Response: {response.text}")
                    return False

        except Exception as e:
            print(f"[ ] API access error: {e}")
            return False

    async def send_test_message(self, to: str) -> bool:
        """Send a test template message."""
        print(f"\nSending test message to {to}...")

        if not self.enable_real:
            print("[DRY-RUN] Would send message to", to)
            print("Set ENABLE_REAL_NOTIFICATIONS=true to send real messages")
            return True

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                payload = {
                    "messaging_product": "whatsapp",
                    "to": to.replace("+", ""),
                    "type": "template",
                    "template": {
                        "name": "ingreso_ok",
                        "language": {"code": "es"},
                        "components": [
                            {
                                "type": "body",
                                "parameters": [
                                    {"type": "text", "text": "Estudiante de Prueba"},
                                    {"type": "text", "text": "27/11/2024"},
                                    {"type": "text", "text": "08:30"},
                                ],
                            }
                        ],
                    },
                }

                response = await client.post(
                    f"{self.base_url}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    print(f"[x] Message sent successfully!")
                    print(f"    Message ID: {data.get('messages', [{}])[0].get('id', 'N/A')}")
                    return True
                else:
                    print(f"[ ] Failed to send message: {response.status_code}")
                    print(f"    Response: {response.text}")
                    return False

        except Exception as e:
            print(f"[ ] Error sending message: {e}")
            return False

    async def send_test_image(self, to: str, image_url: str) -> bool:
        """Send a test image message with caption."""
        print(f"\nSending test image to {to}...")
        print(f"Image URL: {image_url}")

        if not self.enable_real:
            print("[DRY-RUN] Would send image to", to)
            print("Set ENABLE_REAL_NOTIFICATIONS=true to send real messages")
            return True

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": to.replace("+", ""),
                    "type": "image",
                    "image": {
                        "link": image_url,
                        "caption": "Ingreso registrado: Estudiante de Prueba ingresó al colegio el 27/11/2024 a las 08:30.",
                    },
                }

                response = await client.post(
                    f"{self.base_url}/messages",
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )

                if response.status_code in (200, 201):
                    data = response.json()
                    print(f"[x] Image sent successfully!")
                    print(f"    Message ID: {data.get('messages', [{}])[0].get('id', 'N/A')}")
                    return True
                else:
                    print(f"[ ] Failed to send image: {response.status_code}")
                    print(f"    Response: {response.text}")
                    return False

        except Exception as e:
            print(f"[ ] Error sending image: {e}")
            return False

    def print_template_info(self):
        """Print information about required templates."""
        print("\n" + "=" * 60)
        print("Required WhatsApp Templates")
        print("=" * 60)
        print("""
The following templates must be created in Meta Business Suite:

1. ingreso_ok
   Category: UTILITY
   Message: "Ingreso registrado: {{1}} ingresó al colegio el {{2}} a las {{3}}."

2. salida_ok
   Category: UTILITY
   Message: "Salida registrada: {{1}} salió del colegio el {{2}} a las {{3}}."

3. no_ingreso_umbral
   Category: UTILITY
   Message: "Alerta: {{1}} no ha registrado ingreso al colegio hoy {{2}}. Por favor verifique su situación."

4. cambio_horario
   Category: UTILITY
   Message: "Aviso: Se ha modificado el horario de {{1}} para el {{2}}. Nuevo horario de entrada: {{3}}. Por favor tome nota."

See docs/whatsapp-templates.md for detailed setup instructions.
""")


async def main():
    parser = argparse.ArgumentParser(
        description="WhatsApp Business API Setup and Validation"
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate configuration and API access",
    )
    parser.add_argument(
        "--test-message",
        metavar="PHONE",
        help="Send a test template message to the specified phone number",
    )
    parser.add_argument(
        "--test-image",
        nargs=2,
        metavar=("PHONE", "IMAGE_URL"),
        help="Send a test image message with caption",
    )
    parser.add_argument(
        "--templates",
        action="store_true",
        help="Show required template information",
    )

    args = parser.parse_args()

    if not any([args.validate, args.test_message, args.test_image, args.templates]):
        parser.print_help()
        return

    setup = WhatsAppSetup()

    if args.templates:
        setup.print_template_info()
        return

    if args.validate:
        if setup.validate_config():
            await setup.verify_api_access()

    if args.test_message:
        await setup.send_test_message(args.test_message)

    if args.test_image:
        phone, image_url = args.test_image
        await setup.send_test_image(phone, image_url)


if __name__ == "__main__":
    asyncio.run(main())
