from __future__ import annotations

import hashlib
import hmac
from unittest.mock import MagicMock

import orjson
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, override_settings

from sentry.auth.services.auth import AuthenticatedToken
from sentry.middleware.viewer_context import ViewerContextMiddleware, _viewer_context_from_request
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.viewer_context import ActorType, ViewerContext, get_viewer_context


class ViewerContextFromRequestTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    def test_anonymous_request(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is None

    def test_session_authenticated_user(self):
        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is None

    def test_token_authenticated_user(self):
        request = self.factory.get("/")
        token = AuthenticatedToken(
            allowed_origins=["*"],
            scopes=["org:read"],
            entity_id=1,
            kind="api_token",
            user_id=self.user.id,
            organization_id=self.organization.id,
        )
        request.user = self.user
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id == self.organization.id
        assert ctx.actor_type is ActorType.USER
        assert ctx.token is token

    def test_org_scoped_token_without_user(self):
        request = self.factory.get("/")
        request.user = AnonymousUser()
        token = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="org_auth_token",
            organization_id=self.organization.id,
        )
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id is None
        assert ctx.organization_id == self.organization.id
        assert ctx.token is token

    def test_token_without_organization(self):
        request = self.factory.get("/")
        token = AuthenticatedToken(
            allowed_origins=[],
            scopes=["org:read"],
            entity_id=1,
            kind="api_token",
            user_id=self.user.id,
        )
        request.user = self.user
        request.auth = token

        ctx = _viewer_context_from_request(request)

        assert ctx.user_id == self.user.id
        assert ctx.organization_id is None
        assert ctx.token is token


class ViewerContextMiddlewareTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    @override_options({"viewer-context.enabled": False})
    def test_skipped_when_disabled(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is None

    @override_options({"viewer-context.enabled": True})
    def test_sets_context_during_request(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is not None
        assert captured[0].user_id == self.user.id

    @override_options({"viewer-context.enabled": True})
    def test_cleans_up_after_request(self):
        middleware = ViewerContextMiddleware(lambda r: MagicMock(status_code=200))

        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert get_viewer_context() is None

    @override_options({"viewer-context.enabled": True})
    def test_cleans_up_on_exception(self):
        def get_response(request):
            raise RuntimeError("boom")

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        try:
            middleware(request)
        except RuntimeError:
            pass

        assert get_viewer_context() is None

    @override_options({"viewer-context.enabled": True})
    def test_anonymous_request_sets_empty_context(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)

        request = self.factory.get("/")
        request.user = AnonymousUser()
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        ctx = captured[0]
        assert ctx is not None
        assert ctx.user_id is None
        assert ctx.organization_id is None
        assert ctx.token is None


TEST_SECRET = "test-shared-secret"


def _sign(payload_bytes: bytes, secret: str = TEST_SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()


def _make_signed_request(
    factory: RequestFactory,
    ctx: ViewerContext,
    issuer: str = "seer",
    secret: str = TEST_SECRET,
    *,
    tamper_signature: str | None = None,
) -> object:
    """Build a request with signed ViewerContext headers."""
    payload = orjson.dumps(ctx.serialize())
    sig = tamper_signature if tamper_signature is not None else _sign(payload, secret)
    request = factory.get(
        "/",
        HTTP_X_VIEWER_CONTEXT=payload.decode("utf-8"),
        HTTP_X_VIEWER_CONTEXT_SIGNATURE=sig,
        HTTP_X_VIEWER_CONTEXT_ISSUER=issuer,
    )
    request.user = AnonymousUser()
    request.auth = None
    return request


@override_settings(SEER_RPC_SHARED_SECRET=[TEST_SECRET])
class ViewerContextSignedHeaderTest(TestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()

    @override_options({"viewer-context.enabled": True})
    def test_valid_signed_header_sets_context(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        ctx = ViewerContext(organization_id=42, actor_type=ActorType.INTEGRATION)
        request = _make_signed_request(self.factory, ctx)

        middleware(request)

        assert len(captured) == 1
        result = captured[0]
        assert result is not None
        assert result.organization_id == 42
        assert result.actor_type == ActorType.INTEGRATION
        assert result.user_id is None
        assert result.token is None

    @override_options({"viewer-context.enabled": True})
    def test_invalid_signature_falls_back_to_request_auth(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        ctx = ViewerContext(organization_id=42, actor_type=ActorType.INTEGRATION)
        request = _make_signed_request(self.factory, ctx, tamper_signature="bad-sig")

        middleware(request)

        assert len(captured) == 1
        result = captured[0]
        # Falls back to request auth — anonymous user, no org
        assert result.organization_id is None
        assert result.actor_type == ActorType.USER

    @override_options({"viewer-context.enabled": True})
    def test_unknown_issuer_falls_back_to_request_auth(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        ctx = ViewerContext(organization_id=42, actor_type=ActorType.INTEGRATION)
        request = _make_signed_request(self.factory, ctx, issuer="unknown-service")

        middleware(request)

        assert len(captured) == 1
        result = captured[0]
        assert result.organization_id is None
        assert result.actor_type == ActorType.USER

    @override_options({"viewer-context.enabled": True})
    def test_missing_headers_falls_back_to_request_auth(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        request = self.factory.get("/")
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        result = captured[0]
        assert result.user_id == self.user.id
        assert result.actor_type == ActorType.USER

    @override_options({"viewer-context.enabled": True})
    def test_signed_header_takes_priority_over_request_auth(self):
        """Even if request has an authenticated user, the signed header wins."""
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        ctx = ViewerContext(organization_id=99, user_id=7, actor_type=ActorType.SYSTEM)
        request = _make_signed_request(self.factory, ctx)
        # Also set a real user on the request
        request.user = self.user
        request.auth = None

        middleware(request)

        assert len(captured) == 1
        result = captured[0]
        # Header wins
        assert result.organization_id == 99
        assert result.user_id == 7
        assert result.actor_type == ActorType.SYSTEM

    @override_options({"viewer-context.enabled": True})
    @override_settings(SEER_RPC_SHARED_SECRET=[TEST_SECRET, "rotated-secret"])
    def test_key_rotation_accepts_old_secret(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        ctx = ViewerContext(organization_id=42, actor_type=ActorType.INTEGRATION)
        # Sign with the rotated (second) secret
        request = _make_signed_request(self.factory, ctx, secret="rotated-secret")

        middleware(request)

        assert len(captured) == 1
        result = captured[0]
        assert result.organization_id == 42

    @override_options({"viewer-context.enabled": False})
    def test_disabled_option_skips_header_check(self):
        captured: list = []

        def get_response(request):
            captured.append(get_viewer_context())
            return MagicMock(status_code=200)

        middleware = ViewerContextMiddleware(get_response)
        ctx = ViewerContext(organization_id=42, actor_type=ActorType.INTEGRATION)
        request = _make_signed_request(self.factory, ctx)

        middleware(request)

        assert len(captured) == 1
        assert captured[0] is None
