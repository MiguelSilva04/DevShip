"""
Rate limiting for auth and deploy/rollback endpoints (register, login, deploy,
rollback, approve, reject) — previously unlimited, allowing credential-stuffing
against /auth/login and unbounded deploy/rollback spam.

Options considered:
- No rate limiting (status quo): rejected, leaves brute-force and spam open.
- slowapi + in-memory storage (chosen): zero new infra, five-minute implementation,
  matches current single-process deployment. Ceiling: counters live in process memory,
  so limits are per-instance, not global — with N replicas an attacker effectively gets
  N times the quota, and a restart resets counters.
- slowapi + Redis storage: correct at scale (shared counters across replicas), but
  requires provisioning Redis, which nothing in this stack currently depends on.
  Deferred until this runs behind more than one instance in production.

Upgrade path: swap Limiter(storage_uri="redis://...") here when a shared store exists;
no call-site changes needed elsewhere, all routes reference this shared `limiter`.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
