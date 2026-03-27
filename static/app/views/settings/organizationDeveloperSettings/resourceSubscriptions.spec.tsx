import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Form} from 'sentry/components/forms/form';
import {Subscriptions} from 'sentry/views/settings/organizationDeveloperSettings/resourceSubscriptions';

describe('Resource Subscriptions', () => {
  describe('initial no-access permissions', () => {
    it('renders disabled checkbox with no issue permission', () => {
      const org = OrganizationFixture({features: ['preprod-artifact-webhooks']});
      render(
        <Subscriptions
          events={[]}
          permissions={{
            Event: 'no-access',
            Team: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
            Member: 'admin',
          }}
          onChange={jest.fn()}
        />,
        {organization: org, additionalWrapper: Form}
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(5);
      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'seer'})).toBeDisabled();
      // preprod_artifact requires Project permission which is 'write' here, so it's enabled
      expect(screen.getByRole('checkbox', {name: 'preprod_artifact'})).toBeEnabled();
    });

    it('hides preprod_artifact checkbox without preprod-artifact-webhooks flag', () => {
      render(
        <Subscriptions
          events={[]}
          permissions={{
            Event: 'no-access',
            Team: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
            Member: 'admin',
          }}
          onChange={jest.fn()}
        />,
        {additionalWrapper: Form}
      );

      expect(screen.getAllByRole('checkbox')).toHaveLength(4);
      expect(
        screen.queryByRole('checkbox', {name: 'preprod_artifact'})
      ).not.toBeInTheDocument();
    });

    it('updates events state when new permissions props is passed', () => {
      render(
        <Subscriptions
          events={[]}
          permissions={{
            Event: 'read',
            Team: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
            Member: 'admin',
          }}
          onChange={jest.fn()}
        />,
        {additionalWrapper: Form}
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeEnabled();
    });
  });

  describe('initial access to permissions', () => {
    it('renders nondisabled checkbox with correct permissions', () => {
      render(
        <Subscriptions
          events={['issue']}
          permissions={{
            Event: 'read',
            Team: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
            Member: 'admin',
          }}
          onChange={jest.fn()}
        />,
        {additionalWrapper: Form}
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeEnabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeEnabled();
    });

    it('revoked permissions also revokes access to corresponding subscriptions', () => {
      render(
        <Subscriptions
          events={['issue']}
          permissions={{
            Event: 'no-access',
            Team: 'no-access',
            Project: 'write',
            Release: 'admin',
            Organization: 'admin',
            Member: 'admin',
          }}
          onChange={jest.fn()}
        />,
        {additionalWrapper: Form}
      );

      expect(screen.getByRole('checkbox', {name: 'issue'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'error'})).toBeDisabled();
      expect(screen.getByRole('checkbox', {name: 'comment'})).toBeDisabled();
    });
  });
});
