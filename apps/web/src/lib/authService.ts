import type { LoginInput, RegistrationInput } from '@uaqa/contracts';
import {
  applyActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase.ts';

export interface AuthUserSnapshot {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string;
  readonly emailVerified: boolean;
}

export class AuthServiceError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
  }
}

export interface AuthService {
  subscribeAuthState(onChange: (user: AuthUserSnapshot | null) => void): () => void;
  register(input: RegistrationInput): Promise<AuthUserSnapshot>;
  login(input: LoginInput): Promise<AuthUserSnapshot>;
  logout(): Promise<void>;
  resendVerificationEmail(): Promise<void>;
  refreshCurrentUser(): Promise<AuthUserSnapshot | null>;
  getFreshIdToken(forceRefresh?: boolean): Promise<string | null>;
  sendPasswordReset(email: string): Promise<void>;
  verifyResetCode(oobCode: string): Promise<void>;
  confirmReset(oobCode: string, newPassword: string): Promise<void>;
  applyEmailVerificationCode(oobCode: string): Promise<void>;
}

function toSnapshot(user: User): AuthUserSnapshot {
  return {
    uid: user.uid,
    email: user.email ?? '',
    displayName: user.displayName ?? 'Family Member',
    emailVerified: user.emailVerified,
  };
}

function extractFirebaseCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return 'auth/unknown';
}

export function mapFirebaseAuthError(
  error: unknown,
  context: 'register' | 'login' | 'verify' | 'reset' | 'session',
): AuthServiceError {
  if (error instanceof AuthServiceError) {
    return error;
  }

  const code = extractFirebaseCode(error);

  switch (code) {
    case 'auth/email-already-in-use':
      return new AuthServiceError(
        code,
        'An account with this email address already exists. Sign in or recover your password.',
      );
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return new AuthServiceError(
        code,
        context === 'login'
          ? 'Invalid email address or password.'
          : 'Please check your email address and try again.',
      );
    case 'auth/weak-password':
      return new AuthServiceError(
        code,
        'Password does not meet minimum strength requirements. Include uppercase, lowercase, numbers, and a special character.',
      );
    case 'auth/too-many-requests':
      return new AuthServiceError(
        code,
        'Too many attempts were detected. Please wait a few minutes before trying again.',
      );
    case 'auth/expired-action-code':
      return new AuthServiceError(
        code,
        'This link has expired. Request a new verification or password reset email.',
      );
    case 'auth/invalid-action-code':
      return new AuthServiceError(
        code,
        'This link is invalid or has already been used. Request a fresh email link.',
      );
    case 'auth/user-disabled':
      return new AuthServiceError(
        code,
        'This account is currently disabled. Contact support for assistance.',
      );
    case 'auth/operation-not-allowed':
      return new AuthServiceError(
        code,
        'Email/password authentication is not enabled yet for this Firebase project.',
      );
    case 'auth/network-request-failed':
      return new AuthServiceError(
        code,
        'Network error while reaching the authentication service. Check your connection and retry.',
      );
    default:
      return new AuthServiceError(
        code,
        'Unable to complete the authentication request right now. Please try again.',
      );
  }
}

export class FirebaseAuthService implements AuthService {
  public subscribeAuthState(onChange: (user: AuthUserSnapshot | null) => void): () => void {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      onChange(user ? toSnapshot(user) : null);
    });
  }

  public async register(input: RegistrationInput): Promise<AuthUserSnapshot> {
    const auth = getFirebaseAuth();
    try {
      const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
      await updateProfile(credential.user, { displayName: input.displayName.trim() });
      await sendEmailVerification(credential.user);
      return {
        uid: credential.user.uid,
        email: credential.user.email ?? input.email,
        displayName: input.displayName.trim(),
        emailVerified: credential.user.emailVerified,
      };
    } catch (error) {
      throw mapFirebaseAuthError(error, 'register');
    }
  }

  public async login(input: LoginInput): Promise<AuthUserSnapshot> {
    const auth = getFirebaseAuth();
    try {
      const credential = await signInWithEmailAndPassword(auth, input.email, input.password);
      await reload(credential.user);
      return toSnapshot(credential.user);
    } catch (error) {
      throw mapFirebaseAuthError(error, 'login');
    }
  }

  public async logout(): Promise<void> {
    const auth = getFirebaseAuth();
    await signOut(auth);
  }

  public async resendVerificationEmail(): Promise<void> {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new AuthServiceError('auth/no-current-user', 'Sign in to resend a verification email.');
    }
    try {
      await sendEmailVerification(user);
    } catch (error) {
      throw mapFirebaseAuthError(error, 'verify');
    }
  }

  public async refreshCurrentUser(): Promise<AuthUserSnapshot | null> {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    try {
      await reload(user);
      return toSnapshot(user);
    } catch (error) {
      throw mapFirebaseAuthError(error, 'session');
    }
  }

  public async getFreshIdToken(forceRefresh = false): Promise<string | null> {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    try {
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      throw mapFirebaseAuthError(error, 'session');
    }
  }

  public async sendPasswordReset(email: string): Promise<void> {
    const auth = getFirebaseAuth();
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      const code = extractFirebaseCode(error);
      // Account-enumeration protection: treat unknown user emails identically to valid accounts.
      if (code === 'auth/user-not-found' || code === 'auth/invalid-email') {
        return;
      }
      throw mapFirebaseAuthError(error, 'reset');
    }
  }

  public async verifyResetCode(oobCode: string): Promise<void> {
    const auth = getFirebaseAuth();
    try {
      await verifyPasswordResetCode(auth, oobCode);
    } catch (error) {
      throw mapFirebaseAuthError(error, 'reset');
    }
  }

  public async confirmReset(oobCode: string, newPassword: string): Promise<void> {
    const auth = getFirebaseAuth();
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
    } catch (error) {
      throw mapFirebaseAuthError(error, 'reset');
    }
  }

  public async applyEmailVerificationCode(oobCode: string): Promise<void> {
    const auth = getFirebaseAuth();
    try {
      await applyActionCode(auth, oobCode);
      if (auth.currentUser) {
        await reload(auth.currentUser);
      }
    } catch (error) {
      throw mapFirebaseAuthError(error, 'verify');
    }
  }
}
