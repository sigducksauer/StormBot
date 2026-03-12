"""
packages/database/models.py
Modelos SQLAlchemy — VendBot v2 completo
Sistemas: multi-tenant, afiliados, tickets, automações, clientes avançados,
notificações, anti-fraude, avaliações, logs de auditoria, assinaturas,
permissões de equipe, API keys públicas, onboarding
"""
from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger, Boolean, Column, DateTime, Enum, Float,
    ForeignKey, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════

class PlanType(str, enum.Enum):
    SIMPLES    = "simples"
    STANDARD   = "standard"
    PREMIUM    = "premium"
    ENTERPRISE = "enterprise"


class OrderStatus(str, enum.Enum):
    PENDING    = "pending"
    PAID       = "paid"
    DELIVERED  = "delivered"
    REFUNDED   = "refunded"
    EXPIRED    = "expired"
    FAILED     = "failed"
    CHARGEBACK = "chargeback"


class PaymentMethod(str, enum.Enum):
    PIX         = "pix"
    CREDIT_CARD = "credit_card"
    BOLETO      = "boleto"
    STRIPE      = "stripe"
    MANUAL      = "manual"


class ProductType(str, enum.Enum):
    DIGITAL      = "digital"
    KEY          = "key"
    ROLE         = "role"
    CHANNEL      = "channel"
    WEBHOOK      = "webhook"
    SUBSCRIPTION = "subscription"
    PHYSICAL     = "physical"
    SERVICE      = "service"
    LICENSE      = "license"


class GatewayType(str, enum.Enum):
    MERCADOPAGO = "mercadopago"
    STRIPE      = "stripe"
    PIX_MANUAL  = "pix_manual"
    ASAAS       = "asaas"
    PUSHINPAY   = "pushinpay"
    MISTICPAY   = "misticpay"
    PAGSEGURO   = "pagseguro"
    PAYPAL      = "paypal"
    VENDPAY     = "vendpay"


class TicketStatus(str, enum.Enum):
    OPEN      = "open"
    PENDING   = "pending"
    CLOSED    = "closed"
    RESOLVED  = "resolved"


class ServerRole(str, enum.Enum):
    OWNER     = "owner"
    ADMIN     = "admin"
    SUPPORT   = "support"
    MODERATOR = "moderator"


class AutomationTrigger(str, enum.Enum):
    ORDER_CREATED         = "order_created"
    ORDER_PAID            = "order_paid"
    ORDER_DELIVERED       = "order_delivered"
    ORDER_EXPIRED         = "order_expired"
    CART_ABANDONED        = "cart_abandoned"
    STOCK_LOW             = "stock_low"
    POST_PURCHASE         = "post_purchase"
    SUBSCRIPTION_EXPIRING = "subscription_expiring"
    PROMOTION             = "promotion"


# ═══════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id           = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    discord_id   = Column(BigInteger, unique=True, nullable=False, index=True)
    username     = Column(String(100), nullable=False)
    email        = Column(String(255), unique=True, nullable=True)
    avatar       = Column(String(512))
    is_active    = Column(Boolean, default=True)
    totp_secret  = Column(String(64), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    servers       = relationship("Server",       back_populates="owner")
    subscriptions = relationship("Subscription", back_populates="user")
    api_keys      = relationship("ApiKey",       back_populates="user")


# ═══════════════════════════════════════════════════════════════
# SERVERS
# ═══════════════════════════════════════════════════════════════

class Server(Base):
    __tablename__ = "servers"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    discord_id       = Column(BigInteger, unique=True, nullable=False, index=True)
    owner_id         = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    owner_discord_id = Column(BigInteger, nullable=True, index=True)
    name             = Column(String(255), nullable=False)
    icon             = Column(String(512))
    is_active        = Column(Boolean, default=True)
    plan             = Column(Enum(PlanType), default=PlanType.SIMPLES, nullable=False)
    fee_override     = Column(Float, nullable=True)
    settings         = Column(JSON, default=dict)
    onboarding_step  = Column(Integer, default=0)
    onboarding_done  = Column(Boolean, default=False)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    owner         = relationship("User",              back_populates="servers")
    products      = relationship("Product",           back_populates="server",    cascade="all, delete-orphan")
    orders        = relationship("Order",             back_populates="server",    cascade="all, delete-orphan")
    gateways      = relationship("PaymentGateway",    back_populates="server",    cascade="all, delete-orphan")
    embed_configs = relationship("EmbedConfig",       back_populates="server",    cascade="all, delete-orphan")
    coupons       = relationship("Coupon",            back_populates="server",    cascade="all, delete-orphan")
    customers     = relationship("Customer",          back_populates="server",    cascade="all, delete-orphan")
    webhooks      = relationship("WebhookConfig",     back_populates="server",    cascade="all, delete-orphan")
    team_members  = relationship("TeamMember",        back_populates="server",    cascade="all, delete-orphan")
    automations   = relationship("Automation",        back_populates="server",    cascade="all, delete-orphan")
    tickets       = relationship("Ticket",            back_populates="server",    cascade="all, delete-orphan")
    notifications = relationship("NotificationConfig",back_populates="server",    cascade="all, delete-orphan")
    affiliates    = relationship("Affiliate",         back_populates="server",    cascade="all, delete-orphan")
    audit_logs    = relationship("AuditLog",          back_populates="server",    cascade="all, delete-orphan")
    blacklist     = relationship("Blacklist",          back_populates="server",    cascade="all, delete-orphan")
    subscriptions = relationship("Subscription",      back_populates="server")

    @property
    def fee_rate(self) -> float:
        if self.fee_override is not None:
            return self.fee_override
        return {
            PlanType.SIMPLES:    7.0,
            PlanType.STANDARD:   4.0,
            PlanType.PREMIUM:    2.0,
            PlanType.ENTERPRISE: 1.0,
        }.get(self.plan, 7.0)


# ═══════════════════════════════════════════════════════════════
# TEAM / PERMISSIONS
# ═══════════════════════════════════════════════════════════════

class TeamMember(Base):
    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("server_id", "discord_id"),)

    id          = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id   = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    discord_id  = Column(BigInteger, nullable=False, index=True)
    username    = Column(String(100), nullable=False)
    role        = Column(Enum(ServerRole), default=ServerRole.SUPPORT, nullable=False)
    permissions = Column(JSON, default=dict)
    is_active   = Column(Boolean, default=True)
    invited_by  = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="team_members")


# ═══════════════════════════════════════════════════════════════
# API KEYS
# ═══════════════════════════════════════════════════════════════

class ApiKey(Base):
    __tablename__ = "api_keys"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id    = Column(UUID(as_uuid=False), ForeignKey("users.id"),    nullable=False, index=True)
    server_id  = Column(UUID(as_uuid=False), ForeignKey("servers.id"),  nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    key_hash   = Column(String(256), nullable=False, unique=True)
    key_prefix = Column(String(16),  nullable=False)
    scopes     = Column(JSON, default=list)
    last_used  = Column(DateTime(timezone=True), nullable=True)
    is_active  = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="api_keys")


# ═══════════════════════════════════════════════════════════════
# SUBSCRIPTIONS (SaaS plans)
# ═══════════════════════════════════════════════════════════════

class Subscription(Base):
    __tablename__ = "subscriptions"

    id             = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id        = Column(UUID(as_uuid=False), ForeignKey("users.id"),   nullable=False)
    server_id      = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False)
    plan           = Column(Enum(PlanType), nullable=False)
    price_paid     = Column(Float, nullable=False)
    billing_cycle  = Column(String(10), default="monthly")
    gateway        = Column(String(50), nullable=True)
    gateway_sub_id = Column(String(255))
    is_active      = Column(Boolean, default=True)
    auto_renew     = Column(Boolean, default=True)
    starts_at      = Column(DateTime(timezone=True), nullable=False)
    ends_at        = Column(DateTime(timezone=True))
    cancelled_at   = Column(DateTime(timezone=True), nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    user   = relationship("User",   back_populates="subscriptions")
    server = relationship("Server", back_populates="subscriptions")


# ═══════════════════════════════════════════════════════════════
# PRODUCTS
# ═══════════════════════════════════════════════════════════════

class Product(Base):
    __tablename__ = "products"

    id               = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id        = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    name             = Column(String(255), nullable=False)
    description      = Column(Text)
    price            = Column(Float, nullable=False)
    original_price   = Column(Float)
    product_type     = Column(Enum(ProductType), nullable=False, default=ProductType.KEY)
    image_url        = Column(String(512))
    is_active        = Column(Boolean, default=True)
    stock            = Column(Integer, default=-1)
    stock_alert      = Column(Integer, default=5)
    sort_order       = Column(Integer, default=0)
    category         = Column(String(100), nullable=True)
    sku              = Column(String(100), nullable=True)
    requires_address = Column(Boolean, default=False)
    delivery_notes   = Column(Text, nullable=True)
    role_id          = Column(BigInteger, nullable=True)   # for ROLE type
    channel_id       = Column(BigInteger, nullable=True)   # for CHANNEL type
    role_duration    = Column(Integer, nullable=True)      # days, null=permanent
    webhook_url      = Column(String(512), nullable=True)  # for WEBHOOK type
    metadata_        = Column("metadata", JSON, default=dict)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    server   = relationship("Server",         back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    keys     = relationship("ProductKey",     back_populates="product", cascade="all, delete-orphan")
    reviews  = relationship("ProductReview",  back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    product_id = Column(UUID(as_uuid=False), ForeignKey("products.id"), nullable=False, index=True)
    name       = Column(String(255), nullable=False)
    price      = Column(Float, nullable=False)
    stock      = Column(Integer, default=-1)
    sku        = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0)
    metadata_  = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="variants")


class ProductKey(Base):
    __tablename__ = "product_keys"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    product_id = Column(UUID(as_uuid=False), ForeignKey("products.id"), nullable=False, index=True)
    key_value  = Column(Text, nullable=False)
    is_used    = Column(Boolean, default=False)
    used_at    = Column(DateTime(timezone=True))
    order_id   = Column(UUID(as_uuid=False), ForeignKey("orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="keys")


class ProductReview(Base):
    __tablename__ = "product_reviews"
    __table_args__ = (UniqueConstraint("product_id", "customer_id"),)

    id          = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    product_id  = Column(UUID(as_uuid=False), ForeignKey("products.id"),  nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=False), ForeignKey("customers.id"), nullable=False, index=True)
    order_id    = Column(UUID(as_uuid=False), ForeignKey("orders.id"),    nullable=True)
    rating      = Column(Integer, nullable=False)
    comment     = Column(Text, nullable=True)
    is_visible  = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    product  = relationship("Product",  back_populates="reviews")
    customer = relationship("Customer")


# ═══════════════════════════════════════════════════════════════
# CUSTOMERS
# ═══════════════════════════════════════════════════════════════

class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("server_id", "discord_id"),)

    id               = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id        = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    discord_id       = Column(BigInteger, nullable=False, index=True)
    username         = Column(String(100), nullable=False)
    email            = Column(String(255))
    notes            = Column(Text, nullable=True)
    total_spent      = Column(Float, default=0.0)
    order_count      = Column(Integer, default=0)
    is_blacklisted   = Column(Boolean, default=False)
    blacklist_reason = Column(Text, nullable=True)
    tags             = Column(JSON, default=list)
    first_purchase   = Column(DateTime(timezone=True), nullable=True)
    last_purchase    = Column(DateTime(timezone=True), nullable=True)
    address          = Column(JSON, default=dict)    # for physical products
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    server  = relationship("Server",   back_populates="customers")
    orders  = relationship("Order",    back_populates="customer")
    tickets = relationship("Ticket",   back_populates="customer")


# ═══════════════════════════════════════════════════════════════
# ORDERS
# ═══════════════════════════════════════════════════════════════

class Order(Base):
    __tablename__ = "orders"

    id                  = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id           = Column(UUID(as_uuid=False), ForeignKey("servers.id"),   nullable=False, index=True)
    customer_id         = Column(UUID(as_uuid=False), ForeignKey("customers.id"), nullable=False, index=True)
    coupon_id           = Column(UUID(as_uuid=False), ForeignKey("coupons.id"),   nullable=True)
    affiliate_id        = Column(UUID(as_uuid=False), ForeignKey("affiliates.id"), nullable=True)
    status              = Column(Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False)
    subtotal            = Column(Float, nullable=False)
    discount            = Column(Float, default=0.0)
    total               = Column(Float, nullable=False)
    fee_rate            = Column(Float, nullable=False)
    fee_amount          = Column(Float, nullable=False)
    net_amount          = Column(Float, nullable=False)
    affiliate_commission = Column(Float, default=0.0)
    payment_method      = Column(String(50), nullable=False)
    gateway             = Column(String(50), nullable=False)
    gateway_order_id    = Column(String(255), nullable=True, index=True)
    pix_code            = Column(Text)
    pix_qr_url          = Column(Text)
    customer_username   = Column(String(100), nullable=True)
    customer_discord_id = Column(BigInteger, nullable=True)
    fraud_score         = Column(Float, default=0.0)
    ip_address          = Column(String(45), nullable=True)
    metadata_           = Column("metadata", JSON, default=dict)
    expires_at          = Column(DateTime(timezone=True))
    paid_at             = Column(DateTime(timezone=True))
    delivered_at        = Column(DateTime(timezone=True))
    refunded_at         = Column(DateTime(timezone=True))
    chargeback_at       = Column(DateTime(timezone=True))
    created_at          = Column(DateTime(timezone=True), server_default=func.now())
    updated_at          = Column(DateTime(timezone=True), onupdate=func.now())

    server    = relationship("Server",    back_populates="orders")
    customer  = relationship("Customer",  back_populates="orders")
    coupon    = relationship("Coupon")
    affiliate = relationship("Affiliate")
    items     = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    order_id    = Column(UUID(as_uuid=False), ForeignKey("orders.id"),           nullable=False, index=True)
    product_id  = Column(UUID(as_uuid=False), ForeignKey("products.id"),         nullable=False)
    variant_id  = Column(UUID(as_uuid=False), ForeignKey("product_variants.id"), nullable=True)
    quantity    = Column(Integer, default=1)
    unit_price  = Column(Float, nullable=False)
    total_price = Column(Float, nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product")


# ═══════════════════════════════════════════════════════════════
# PAYMENT GATEWAYS
# ═══════════════════════════════════════════════════════════════

class PaymentGateway(Base):
    __tablename__ = "payment_gateways"
    __table_args__ = (UniqueConstraint("server_id", "gateway_type"),)

    id           = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id    = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    gateway_type = Column(Enum(GatewayType), nullable=False)
    credentials  = Column(JSON, default=dict)
    config       = Column(JSON, default=dict)
    is_active    = Column(Boolean, default=True)
    webhook_url  = Column(String(512), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    server = relationship("Server", back_populates="gateways")


# ═══════════════════════════════════════════════════════════════
# EMBED CONFIGS
# ═══════════════════════════════════════════════════════════════

class EmbedConfig(Base):
    __tablename__ = "embed_configs"
    __table_args__ = (UniqueConstraint("server_id", "name"),)

    id            = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id     = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    name          = Column(String(100), nullable=False)
    title         = Column(String(256))
    description   = Column(Text)
    color         = Column(String(10), default="#7c3aed")
    thumbnail_url = Column(String(512))
    image_url     = Column(String(512))
    footer_text   = Column(String(2048))
    footer_icon   = Column(String(512))
    author_name   = Column(String(256))
    author_icon   = Column(String(512))
    fields        = Column(JSON, default=list)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    server = relationship("Server", back_populates="embed_configs")


# ═══════════════════════════════════════════════════════════════
# COUPONS
# ═══════════════════════════════════════════════════════════════

class Coupon(Base):
    __tablename__ = "coupons"
    __table_args__ = (UniqueConstraint("server_id", "code"),)

    id                = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id         = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    code              = Column(String(50), nullable=False)
    description       = Column(String(255), nullable=True)
    discount_type     = Column(String(10), nullable=False)
    discount_value    = Column(Float, nullable=False)
    min_purchase      = Column(Float, default=0.0)
    max_uses          = Column(Integer, default=-1)
    max_uses_per_user = Column(Integer, default=-1)
    used_count        = Column(Integer, default=0)
    product_ids       = Column(JSON, default=list)
    category          = Column(String(100), nullable=True)
    is_active         = Column(Boolean, default=True)
    expires_at        = Column(DateTime(timezone=True))
    created_at        = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="coupons")


# ═══════════════════════════════════════════════════════════════
# WEBHOOKS
# ═══════════════════════════════════════════════════════════════

class WebhookConfig(Base):
    __tablename__ = "webhook_configs"

    id           = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id    = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    url          = Column(String(512), nullable=False)
    secret       = Column(String(255))
    events       = Column(JSON, default=list)
    is_active    = Column(Boolean, default=True)
    fail_count   = Column(Integer, default=0)
    last_success = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="webhooks")


# ═══════════════════════════════════════════════════════════════
# AFFILIATES
# ═══════════════════════════════════════════════════════════════

class Affiliate(Base):
    __tablename__ = "affiliates"
    __table_args__ = (UniqueConstraint("server_id", "discord_id"),)

    id                 = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id          = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    discord_id         = Column(BigInteger, nullable=False, index=True)
    username           = Column(String(100), nullable=False)
    referral_code      = Column(String(32), nullable=False, unique=True)
    commission_rate    = Column(Float, default=5.0)
    total_referrals    = Column(Integer, default=0)
    total_revenue      = Column(Float, default=0.0)
    total_commission   = Column(Float, default=0.0)
    pending_commission = Column(Float, default=0.0)
    paid_commission    = Column(Float, default=0.0)
    is_active          = Column(Boolean, default=True)
    pix_key            = Column(String(255), nullable=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    server  = relationship("Server", back_populates="affiliates")
    payouts = relationship("AffiliatePayout", back_populates="affiliate", cascade="all, delete-orphan")


class AffiliatePayout(Base):
    __tablename__ = "affiliate_payouts"

    id           = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    affiliate_id = Column(UUID(as_uuid=False), ForeignKey("affiliates.id"), nullable=False, index=True)
    amount       = Column(Float, nullable=False)
    status       = Column(String(20), default="pending")
    paid_at      = Column(DateTime(timezone=True), nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    affiliate = relationship("Affiliate", back_populates="payouts")


# ═══════════════════════════════════════════════════════════════
# TICKETS
# ═══════════════════════════════════════════════════════════════

class Ticket(Base):
    __tablename__ = "tickets"

    id              = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id       = Column(UUID(as_uuid=False), ForeignKey("servers.id"),   nullable=False, index=True)
    customer_id     = Column(UUID(as_uuid=False), ForeignKey("customers.id"), nullable=False, index=True)
    order_id        = Column(UUID(as_uuid=False), ForeignKey("orders.id"),    nullable=True)
    channel_id      = Column(BigInteger, nullable=True)
    subject         = Column(String(255), nullable=False)
    status          = Column(Enum(TicketStatus), default=TicketStatus.OPEN, nullable=False)
    priority        = Column(String(10), default="normal")
    assigned_to     = Column(UUID(as_uuid=False), ForeignKey("team_members.id"), nullable=True)
    rating          = Column(Integer, nullable=True)
    rating_comment  = Column(Text, nullable=True)
    transcript      = Column(JSON, default=list)
    closed_at       = Column(DateTime(timezone=True), nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())

    server   = relationship("Server",   back_populates="tickets")
    customer = relationship("Customer", back_populates="tickets")
    messages = relationship("TicketMessage", back_populates="ticket", cascade="all, delete-orphan")


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    ticket_id   = Column(UUID(as_uuid=False), ForeignKey("tickets.id"), nullable=False, index=True)
    author_id   = Column(BigInteger, nullable=False)
    author_name = Column(String(100), nullable=False)
    content     = Column(Text, nullable=False)
    is_staff    = Column(Boolean, default=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("Ticket", back_populates="messages")


# ═══════════════════════════════════════════════════════════════
# AUTOMATIONS
# ═══════════════════════════════════════════════════════════════

class Automation(Base):
    __tablename__ = "automations"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id  = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    name       = Column(String(255), nullable=False)
    trigger    = Column(Enum(AutomationTrigger), nullable=False)
    conditions = Column(JSON, default=dict)
    actions    = Column(JSON, default=list)
    is_active  = Column(Boolean, default=True)
    run_count  = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    server = relationship("Server", back_populates="automations")


# ═══════════════════════════════════════════════════════════════
# NOTIFICATIONS
# ═══════════════════════════════════════════════════════════════

class NotificationConfig(Base):
    __tablename__ = "notification_configs"

    id                 = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id          = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    event              = Column(String(50), nullable=False)
    channels           = Column(JSON, default=list)
    discord_channel_id = Column(BigInteger, nullable=True)
    email_to           = Column(String(255), nullable=True)
    webhook_url        = Column(String(512), nullable=True)
    is_active          = Column(Boolean, default=True)
    created_at         = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="notifications")


# ═══════════════════════════════════════════════════════════════
# BLACKLIST / ANTI-FRAUD
# ═══════════════════════════════════════════════════════════════

class Blacklist(Base):
    __tablename__ = "blacklists"

    id         = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id  = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    discord_id = Column(BigInteger, nullable=True, index=True)
    ip_address = Column(String(45), nullable=True)
    email      = Column(String(255), nullable=True)
    reason     = Column(Text, nullable=True)
    added_by   = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="blacklist")


# ═══════════════════════════════════════════════════════════════
# AUDIT LOGS
# ═══════════════════════════════════════════════════════════════

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    server_id   = Column(UUID(as_uuid=False), ForeignKey("servers.id"), nullable=False, index=True)
    user_id     = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    action      = Column(String(60), nullable=False, index=True)
    resource    = Column(String(50), nullable=True)
    resource_id = Column(String(36), nullable=True)
    changes     = Column(JSON, default=dict)
    ip_address  = Column(String(45), nullable=True)
    user_agent  = Column(String(512), nullable=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="audit_logs")
