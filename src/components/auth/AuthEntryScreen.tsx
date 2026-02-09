import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import Colors from '@/constants/Colors';
import BrandLockup from '@/src/components/BrandLockup';
import {
  signInWithAppleProvider,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from '@/src/services/authService';

type AuthMode = 'login' | 'signup';

interface AuthEntryScreenProps {
  mode: AuthMode;
}

export default function AuthEntryScreen({ mode }: AuthEntryScreenProps) {
  const isSignup = mode === 'signup';
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  async function handleEmailPasswordSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }

    if (isSignup) {
      if (!firstName.trim()) {
        Alert.alert('Missing first name', 'Please enter your first name.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Weak password', 'Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password mismatch', 'Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        await signUpWithEmailPassword(email, password, firstName);
      } else {
        await signInWithEmailPassword(email, password);
      }
      // Auth state listener handles navigation.
    } catch (error: any) {
      let message = error?.message || 'Could not sign in.';
      if (error?.code === 'auth/invalid-email') {
        message = 'Enter a valid email address.';
      } else if (error?.code === 'auth/user-not-found') {
        message = 'No account found with that email.';
      } else if (error?.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (error?.code === 'auth/email-already-in-use') {
        message = 'An account with this email already exists.';
      } else if (error?.code === 'auth/weak-password') {
        message = 'Password must be at least 6 characters.';
      } else if (error?.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please wait and try again.';
      }
      Alert.alert(isSignup ? 'Sign Up Failed' : 'Sign In Failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    setAppleLoading(true);
    try {
      await signInWithAppleProvider();
      // Auth state listener handles navigation.
    } catch (error: any) {
      let message = error?.message || 'Could not sign in with Apple.';
      if (error?.code === 'auth/operation-not-allowed') {
        message = 'Enable Apple sign-in in Firebase Auth settings.';
      } else if (
        error?.code === 'auth/web-context-cancelled' ||
        error?.code === 'ERR_REQUEST_CANCELED'
      ) {
        message = 'Apple sign-in was cancelled.';
      }
      Alert.alert('Apple Sign In Failed', message);
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <BrandLockup size="lg" />
        <Text style={styles.tagline}>
          {isSignup ? 'Create your account' : 'Sign in to your account'}
        </Text>
        <Text style={styles.subTagline}>Email/password plus Apple sign-in</Text>
      </View>

      <View style={styles.form}>
        {isSignup ? (
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor={Colors.light.textSecondary}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="name-given"
            editable={!submitting && !appleLoading}
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          placeholderTextColor={Colors.light.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!submitting && !appleLoading}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.light.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          editable={!submitting && !appleLoading}
        />

        {isSignup ? (
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={Colors.light.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            editable={!submitting && !appleLoading}
          />
        ) : null}

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleEmailPasswordSubmit}
          disabled={submitting || appleLoading}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.brand.cream} />
          ) : (
            <Text style={styles.buttonText}>{isSignup ? 'Create Account' : 'Sign In'}</Text>
          )}
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              style={[styles.secondaryButton, appleLoading && styles.buttonDisabled]}
              onPress={handleAppleSignIn}
              disabled={submitting || appleLoading}
              activeOpacity={0.8}
            >
              {appleLoading ? (
                <ActivityIndicator color={Colors.brand.sageDark} />
              ) : (
                <Text style={styles.secondaryButtonText}>Continue with Apple</Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <View style={styles.footer}>
          {isSignup ? (
            <>
              <Text style={styles.footerText}>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </>
          ) : (
            <>
              <Text style={styles.footerText}>Need a new account? </Text>
              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Create One</Text>
                </TouchableOpacity>
              </Link>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.brand.cream,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  tagline: {
    fontSize: 18,
    color: Colors.light.text,
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  subTagline: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  form: {
    gap: 14,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.card,
  },
  button: {
    minHeight: 52,
    backgroundColor: Colors.brand.sage,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.brand.cream,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.brand.sage,
    backgroundColor: Colors.light.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.brand.sageDark,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 14,
    flexWrap: 'wrap',
  },
  footerText: {
    color: Colors.light.textSecondary,
    fontSize: 15,
  },
  linkText: {
    color: Colors.brand.sageDark,
    fontSize: 15,
    fontWeight: '600',
  },
});
