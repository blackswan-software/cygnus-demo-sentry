from __future__ import annotations

from django.http import HttpRequest, HttpResponse, HttpResponseRedirect
from django.urls import reverse

from sentry.api.endpoints.accept_organization_invite import get_invite_state
from sentry.demo_mode.utils import is_demo_user
from sentry.utils.http import query_string
from sentry.web.frontend.react_page import GenericReactPageView


# TODO(cells): Temporary redirect to support previous invitations. Remove after May 8th
class AcceptOrganizationInviteRedirectView(GenericReactPageView):
    auth_required = False

    def handle(self, request: HttpRequest, member_id: int, token: str, **kwargs) -> HttpResponse:
        if request.user.is_authenticated and not is_demo_user(request.user):
            user_id: int | None = request.user.id
        else:
            user_id = None

        invite_context = get_invite_state(
            member_id=member_id,
            organization_id_or_slug=None,
            user_id=user_id,
            request=request,
        )
        if invite_context is None:
            return self.handle_react(request, **kwargs)

        redirect_url = reverse(
            "sentry-organization-accept-invite",
            kwargs={
                "organization_slug": invite_context.organization.slug,
                "member_id": member_id,
                "token": token,
            },
        )
        return HttpResponseRedirect(f"{redirect_url}{query_string(request)}")
