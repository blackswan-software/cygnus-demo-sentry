import {addInstallableFilter, removeInstallableFilter} from './installableQueryUtils';

describe('addInstallableFilter', () => {
  it('adds installable:true to an empty query', () => {
    expect(addInstallableFilter('')).toBe('installable:true');
  });

  it('appends installable:true to an existing query', () => {
    expect(addInstallableFilter('app_id:com.example')).toBe(
      'app_id:com.example installable:true'
    );
  });

  it('does not double-add if already present', () => {
    expect(addInstallableFilter('installable:true')).toBe('installable:true');
  });

  it('does not double-add when mixed with other tokens', () => {
    expect(addInstallableFilter('app_id:com.example installable:true')).toBe(
      'app_id:com.example installable:true'
    );
  });

  it('replaces installable:false with installable:true', () => {
    expect(addInstallableFilter('installable:false')).toBe('installable:true');
  });
});

describe('removeInstallableFilter', () => {
  it('removes installable:true from a query', () => {
    expect(removeInstallableFilter('app_id:com.example installable:true')).toBe(
      'app_id:com.example'
    );
  });

  it('returns empty string when only installable:true', () => {
    expect(removeInstallableFilter('installable:true')).toBe('');
  });

  it('is a no-op when installable is not present', () => {
    expect(removeInstallableFilter('app_id:com.example')).toBe('app_id:com.example');
  });

  it('returns empty string for empty input', () => {
    expect(removeInstallableFilter('')).toBe('');
  });
});
