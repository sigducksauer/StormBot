"""
apps/api/gateways/mercadopago.py
Integração completa com Mercado Pago — Pix, cartão, boleto
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Optional

import httpx

log = logging.getLogger("gateway.mp")

MP_BASE_URL = "https://api.mercadopago.com"


class MercadoPagoGateway:
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": str(uuid.uuid4()),
        }

    async def create_pix(
        self,
        order_id: str,
        amount: float,
        description: str,
        payer_email: str,
        payer_name: str,
        expiration_minutes: int = 15,
    ) -> dict:
        """Gera cobrança Pix via Mercado Pago."""
        from datetime import datetime, timedelta

        expires_at = (datetime.utcnow() + timedelta(minutes=expiration_minutes)).strftime(
            "%Y-%m-%dT%H:%M:%S.000-03:00"
        )

        payload = {
            "transaction_amount": round(amount, 2),
            "description": description[:60],
            "payment_method_id": "pix",
            "external_reference": order_id,
            "date_of_expiration": expires_at,
            "payer": {
                "email": payer_email or "comprador@vendbot.com.br",
                "first_name": payer_name.split()[0] if payer_name else "Comprador",
                "last_name": payer_name.split()[-1] if payer_name and len(payer_name.split()) > 1 else "VendBot",
            },
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MP_BASE_URL}/v1/payments",
                json=payload,
                headers=self.headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

        pix_data = data.get("point_of_interaction", {}).get("transaction_data", {})
        log.info(f"[MP PIX] Criado | order={order_id} | mp_id={data['id']} | R${amount:.2f}")

        return {
            "gateway_order_id": str(data["id"]),
            "pix_code": pix_data.get("qr_code"),
            "pix_qr_url": pix_data.get("qr_code_base64"),
            "status": data.get("status"),
            "expires_at": expires_at,
        }

    async def create_card_payment(
        self,
        order_id: str,
        amount: float,
        description: str,
        token: str,         # token gerado pelo MP.js no frontend
        installments: int,
        payer_email: str,
        issuer_id: str,
        payment_method_id: str,
    ) -> dict:
        """Processa pagamento com cartão."""
        payload = {
            "transaction_amount": round(amount, 2),
            "token": token,
            "description": description[:60],
            "installments": installments,
            "payment_method_id": payment_method_id,
            "issuer_id": issuer_id,
            "external_reference": order_id,
            "payer": {"email": payer_email},
        }

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MP_BASE_URL}/v1/payments",
                json=payload,
                headers=self.headers,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

        log.info(f"[MP CARD] order={order_id} | status={data['status']}")
        return {
            "gateway_order_id": str(data["id"]),
            "status": data.get("status"),
            "status_detail": data.get("status_detail"),
        }

    async def get_payment(self, payment_id: str) -> dict:
        """Busca dados de um pagamento pelo ID."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{MP_BASE_URL}/v1/payments/{payment_id}",
                headers=self.headers,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()

    async def refund_payment(self, payment_id: str, amount: Optional[float] = None) -> dict:
        """Reembolsa um pagamento (total ou parcial)."""
        payload = {}
        if amount:
            payload["amount"] = round(amount, 2)

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{MP_BASE_URL}/v1/payments/{payment_id}/refunds",
                json=payload,
                headers={**self.headers, "X-Idempotency-Key": str(uuid.uuid4())},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()

        log.info(f"[MP REFUND] payment_id={payment_id} | status={data.get('status')}")
        return data


class StripeGateway:
    def __init__(self, secret_key: str):
        import stripe
        stripe.api_key = secret_key
        self.stripe = stripe

    async def create_payment_intent(
        self,
        order_id: str,
        amount_brl: float,
        description: str,
        customer_email: str,
    ) -> dict:
        """Cria PaymentIntent no Stripe (valor em centavos)."""
        import asyncio
        amount_cents = int(round(amount_brl * 100))

        intent = await asyncio.to_thread(
            self.stripe.PaymentIntent.create,
            amount=amount_cents,
            currency="brl",
            description=description,
            receipt_email=customer_email,
            metadata={"order_id": order_id},
        )
        log.info(f"[STRIPE] PaymentIntent criado | order={order_id} | id={intent.id}")
        return {
            "gateway_order_id": intent.id,
            "client_secret": intent.client_secret,
            "status": intent.status,
        }

    async def refund(self, payment_intent_id: str) -> dict:
        import asyncio
        refund = await asyncio.to_thread(
            self.stripe.Refund.create,
            payment_intent=payment_intent_id,
        )
        return {"refund_id": refund.id, "status": refund.status}


class PixManualGateway:
    """Gateway de Pix manual — gera QR code via API do Banco Central ou lib local."""

    def __init__(self, pix_key: str, pix_key_type: str, merchant_name: str, merchant_city: str):
        self.pix_key       = pix_key
        self.pix_key_type  = pix_key_type
        self.merchant_name = merchant_name[:25]
        self.merchant_city = merchant_city[:15]

    def generate_pix_code(self, amount: float, order_id: str, description: str) -> str:
        """Gera payload Pix estático/dinâmico seguindo o padrão EMV."""
        # Implementação simplificada do payload Pix BR Code
        def field(id_: str, value: str) -> str:
            return f"{id_}{len(value):02d}{value}"

        key_type_map = {
            "cpf": "CPF", "email": "EMAIL",
            "telefone": "PHONE", "aleatoria": "EVP"
        }

        merchant_account = field("00", "BR.GOV.BCB.PIX") + field("01", self.pix_key)
        ma = field("26", merchant_account)

        payload = (
            field("00", "01")  # Payload format
            + ma
            + field("52", "0000")   # MCC
            + field("53", "986")    # BRL
            + field("54", f"{amount:.2f}")
            + field("58", "BR")
            + field("59", self.merchant_name)
            + field("60", self.merchant_city)
            + field("62", field("05", order_id[:25]))
            + "6304"
        )

        # CRC16 CCITT
        crc = self._crc16(payload)
        return payload + f"{crc:04X}"

    def _crc16(self, data: str) -> int:
        poly = 0x1021
        crc  = 0xFFFF
        for byte in data.encode("utf-8"):
            crc ^= byte << 8
            for _ in range(8):
                if crc & 0x8000:
                    crc = (crc << 1) ^ poly
                else:
                    crc <<= 1
                crc &= 0xFFFF
        return crc
