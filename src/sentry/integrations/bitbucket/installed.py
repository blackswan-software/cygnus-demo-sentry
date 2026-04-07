from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.integrations.jira.webhooks.installed import INVALID_KEY_IDS
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    authenticate_asymmetric_jwt,
    get_token,
    verify_claims,
)
from sentry.utils import jwt

from .integration import BitbucketIntegrationProvider


@control_silo_endpoint
class BitbucketInstalledEndpoint(Endpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = ()
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        return super().dispatch(request, *args, **kwargs)

    def post(self, request: Request, *args, **kwargs) -> Response:
        try:
            token = get_token(request)
        except AtlassianConnectValidationError:
            return self.respond(
                {"detail": "Missing authorization header"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            key_id = jwt.peek_header(token).get("kid")
        except jwt.DecodeError:
            return self.respond(
                {"detail": "Invalid JWT token"}, status=status.HTTP_400_BAD_REQUEST
            )
        if not key_id:
            return self.respond({"detail": "Missing key id"}, status=status.HTTP_400_BAD_REQUEST)

        if key_id in INVALID_KEY_IDS:
            return self.respond({"detail": "Invalid key id"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded_claims = authenticate_asymmetric_jwt(token, key_id)
            verify_claims(decoded_claims, request.path, request.GET, method="POST")
        except AtlassianConnectValidationError:
            return self.respond(
                {"detail": "Could not validate JWT"}, status=status.HTTP_400_BAD_REQUEST
            )

        state = request.data
        if decoded_claims.get("iss") != state.get("clientKey"):
            return self.respond(
                {"detail": "JWT issuer does not match client key"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        data = BitbucketIntegrationProvider().build_integration(state)
        ensure_integration(IntegrationProviderSlug.BITBUCKET.value, data)

        return self.respond()
