import { describe, expect, it } from 'vitest';
import { prettifyId } from './prettify.js';

describe('prettifyId', () => {
  it('strips the B2C_1A_ prefix before prettifying', () => {
    expect(prettifyId('B2C_1A_SignUpOrSignIn')).toBe('Sign Up Or Sign In');
  });

  it('splits PascalCase identifiers into words', () => {
    expect(prettifyId('PasswordReset')).toBe('Password Reset');
  });

  it('normalizes underscore-delimited identifiers into title case', () => {
    expect(prettifyId('signup_signin')).toBe('Signup Signin');
  });

  it('returns an empty string for blank input', () => {
    expect(prettifyId('   ')).toBe('');
  });
});
