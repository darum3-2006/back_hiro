import { ForbiddenException, type CallHandler, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import type { AuthenticatedUser } from './jwt.strategy';
import { ReadonlyWriteBlockInterceptor } from './readonly-write-block.interceptor';

describe('ReadonlyWriteBlockInterceptor', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let interceptor: ReadonlyWriteBlockInterceptor;
  let next: CallHandler;

  const makeContext = (method: string, user?: AuthenticatedUser): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ method, user }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  const readonlyUser: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'readonly' };
  const memberUser: AuthenticatedUser = { userId: 'u2', tenantId: 't1', role: 'member' };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    interceptor = new ReadonlyWriteBlockInterceptor(reflector as unknown as Reflector);
    next = { handle: jest.fn().mockReturnValue(of('ok')) };
  });

  it('GET は readonly でも通す', () => {
    expect(() => interceptor.intercept(makeContext('GET', readonlyUser), next)).not.toThrow();
    expect(next.handle).toHaveBeenCalled();
  });

  it('readonly の書き込みは 403', () => {
    expect(() => interceptor.intercept(makeContext('POST', readonlyUser), next)).toThrow(
      ForbiddenException,
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('@AllowReadonly 付きなら readonly の書き込みも通す', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(() => interceptor.intercept(makeContext('PATCH', readonlyUser), next)).not.toThrow();
    expect(next.handle).toHaveBeenCalled();
  });

  it('readonly 以外のユーザーの書き込みは通す', () => {
    expect(() => interceptor.intercept(makeContext('DELETE', memberUser), next)).not.toThrow();
    expect(next.handle).toHaveBeenCalled();
  });

  it('未認証（user なし = login 等）の書き込みは対象外', () => {
    expect(() => interceptor.intercept(makeContext('POST'), next)).not.toThrow();
    expect(next.handle).toHaveBeenCalled();
  });
});
