from __future__ import annotations

import hashlib
import hmac
import logging
from collections.abc import Callable

from django.conf import settings
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import options
from sentry.viewer_context import (
    ActorType,
    ViewerContext,
    viewer_context_scope,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Issuer → shared-secret mapping
#
# Each internal service that propagates ViewerContext over HTTP identifies
# itself with an issuer string in the ``X-Viewer-Context-Issuer`` header.
# The middleware maps that string to a list of shared secrets (list to
# support key rotation — the first valid match wins).
#
# To add a new service:
#   1. Define a shared secret setting in conf/server.py
#   2. Add the (issuer, setting) pair to _ISSUER_SECRETS below
#   3. Have the service call inject_viewer_context_headers() with the
#      matching issuer string and secret
# ---------------------------------------------------------------------------


def _get_issuer_secrets() -> dict[str, list[str]]:
    """Build the issuer → secrets mapping from current settings.

    Called once per request (cheap dict construction) so that hot-reloaded
    settings are picked up without restart.
    """
    mapping: dict[str, list[str]] = {}

    if settings.RPC_SHARED_SECRET:
        mapping["sentry"] = settings.RPC_SHARED_SECRET

    if settings.SEER_RPC_SHARED_SECRET:
        mapping["seer"] = settings.SEER_RPC_SHARED_SECRET

    if settings.SCM_RPC_SHARED_SECRET:
        mapping["scm"] = settings.SCM_RPC_SHARED_SECRET

    if settings.LAUNCHPAD_RPC_SHARED_SECRET:
        mapping["launchpad"] = settings.LAUNCHPAD_RPC_SHARED_SECRET

    return mapping


def _verify_viewer_context_header(request: HttpRequest) -> ViewerContext | None:
    """Attempt to extract a signed ViewerContext from request headers.

    Returns a ``ViewerContext`` if all three headers are present, the issuer
    is recognized, and the HMAC signature is valid.  Returns ``None``
    otherwise (missing headers, unknown issuer, bad signature).

    This is the receiving side of ``inject_viewer_context_headers()``.
    """
    # Django normalizes headers: X-Foo-Bar → HTTP_X_FOO_BAR
    raw_context = request.META.get("HTTP_X_VIEWER_CONTEXT")
    signature = request.META.get("HTTP_X_VIEWER_CONTEXT_SIGNATURE")
    issuer = request.META.get("HTTP_X_VIEWER_CONTEXT_ISSUER")

    if not raw_context or not signature or not issuer:
        return None

    secrets = _get_issuer_secrets().get(issuer)
    if not secrets:
        logger.warning(
            "viewer_context.unknown_issuer",
            extra={"issuer": issuer},
        )
        return None

    context_bytes = raw_context.encode("utf-8")

    # Try each secret (supports key rotation)
    verified = False
    for secret in secrets:
        expected = hmac.new(
            secret.encode("utf-8"),
            context_bytes,
            hashlib.sha256,
        ).hexdigest()
        if hmac.compare_digest(expected, signature):
            verified = True
            break

    if not verified:
        logger.warning(
            "viewer_context.invalid_signature",
            extra={"issuer": issuer},
        )
        return None

    return ViewerContext.deserialize(raw_context)


def ViewerContextMiddleware(
    get_response: Callable[[HttpRequest], HttpResponseBase],
) -> Callable[[HttpRequest], HttpResponseBase]:
    """Set :class:`ViewerContext` for every request.

    Two sources, checked in order:

    1. **Signed header** — if the request carries ``X-Viewer-Context``,
       ``X-Viewer-Context-Signature``, and ``X-Viewer-Context-Issuer``
       headers, the middleware verifies the HMAC signature against the
       shared secret for that issuer.  On success, the header payload
       becomes the ViewerContext for the request.  This path is used by
       internal service-to-service calls (Seer, cross-silo RPC, etc.).

    2. **Request auth** — falls back to deriving ViewerContext from
       ``request.user`` and ``request.auth`` (populated by Django's
       ``AuthenticationMiddleware``).  This is the normal path for
       browser/API-token requests.

    Gated by the ``viewer-context.enabled`` option (FLAG_NOSTORE).
    Must be placed **after** ``AuthenticationMiddleware``.
    """
    enabled = options.get("viewer-context.enabled")

    def ViewerContextMiddleware_impl(request: HttpRequest) -> HttpResponseBase:
        if not enabled:
            return get_response(request)

        # Skip static assets — avoids touching user session and setting
        # Vary: Cookie which breaks HTTP caching.
        if request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES):
            return get_response(request)

        # Source 1: signed header from internal service
        ctx = _verify_viewer_context_header(request)

        # Source 2: derive from request auth
        if ctx is None:
            ctx = _viewer_context_from_request(request)

        with viewer_context_scope(ctx):
            return get_response(request)

    return ViewerContextMiddleware_impl


def _viewer_context_from_request(request: HttpRequest) -> ViewerContext:
    user = request.user
    auth = getattr(request, "auth", None)

    user_id: int | None = None
    if user.is_authenticated:
        user_id = user.id

    organization_id: int | None = None
    if auth is not None and hasattr(auth, "organization_id"):
        organization_id = auth.organization_id

    return ViewerContext(
        user_id=user_id,
        organization_id=organization_id,
        actor_type=ActorType.USER,
        token=auth,
    )
