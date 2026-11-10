import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FacebookAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { apiBaseUrl } from '../config/api';
import { apiRequest, getErrorMessage } from '../services/api';

const AuthContext = createContext(null);

async function loadMongoProfile(firebaseUser) {
  const getIdToken = () => firebaseUser.getIdToken();
  await apiRequest('/auth/register', {
    getIdToken,
    apiBaseUrl,
    method: 'POST',
  });
  return apiRequest('/auth/me', { getIdToken, apiBaseUrl });
}

function firebaseSetupError() {
  return new Error(
    'Firebase is not configured. Copy .env.example to .env.local and add your Firebase web app settings.'
  );
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [authError, setAuthError] = useState(
    auth ? '' : 'Firebase is not configured. Add the VITE_FIREBASE_* settings to .env.local.'
  );
  const profileRequests = useRef(new Map());
  const authEventVersion = useRef(0);
  const getIdToken = useCallback(
    () => (firebaseUser ? firebaseUser.getIdToken() : Promise.reject(new Error('You are not signed in.'))),
    [firebaseUser]
  );
  const refreshProfile = useCallback(async () => {
    if (!firebaseUser) throw new Error('You are not signed in.');
    const profile = await apiRequest('/auth/me', {
      getIdToken: () => firebaseUser.getIdToken(),
      apiBaseUrl,
    });
    setUser(profile);
    window.dispatchEvent(new CustomEvent('tlbc:profile-updated', { detail: profile }));
    return profile;
  }, [firebaseUser]);
  const updateUserProfile = useCallback((updates) => {
    setUser((current) => (current ? { ...current, ...updates } : current));
    window.dispatchEvent(
      new CustomEvent('tlbc:profile-updated', { detail: updates })
    );
  }, []);

  const syncProfile = useCallback(async (signedInUser) => {
    const pending = profileRequests.current.get(signedInUser.uid);
    if (pending) return pending;

    const request = loadMongoProfile(signedInUser).finally(() => {
      profileRequests.current.delete(signedInUser.uid);
    });
    profileRequests.current.set(signedInUser.uid, request);
    return request;
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (signedInUser) => {
      if (!active) return;
      const eventVersion = ++authEventVersion.current;
      setFirebaseUser(signedInUser);
      setAuthError('');

      if (!signedInUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const profile = await syncProfile(signedInUser);
        if (active && eventVersion === authEventVersion.current) {
          setUser(profile);
        }
      } catch (error) {
        if (active && eventVersion === authEventVersion.current) {
          setUser(null);
          setAuthError(getErrorMessage(error));
        }
      } finally {
        if (active && eventVersion === authEventVersion.current) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [syncProfile]);

  const finishSignIn = useCallback(
    async (credential) => {
      setAuthError('');
      setLoading(true);
      setFirebaseUser(credential.user);
      try {
        const profile = await syncProfile(credential.user);
        setUser(profile);
        return profile;
      } catch (error) {
        setUser(null);
        setAuthError(getErrorMessage(error));
        if (auth) await signOut(auth);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [syncProfile]
  );

  const loginWithEmail = useCallback(
    async (email, password) => {
      if (!auth) throw firebaseSetupError();
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      return finishSignIn(credential);
    },
    [finishSignIn]
  );

  const resetPassword = useCallback(async (email) => {
    if (!auth) throw firebaseSetupError();
    await sendPasswordResetEmail(auth, email);
  }, []);

  const finishCustomTokenSignIn = useCallback(
    async (customToken) => {
      if (!auth) throw firebaseSetupError();
      return finishSignIn(await signInWithCustomToken(auth, customToken));
    },
    [finishSignIn]
  );

  const loginWithGoogle = useCallback(async () => {
    if (!auth) throw firebaseSetupError();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return finishSignIn(await signInWithPopup(auth, provider));
  }, [finishSignIn]);

  const loginWithFacebook = useCallback(async () => {
    if (!auth) throw firebaseSetupError();
    const provider = new FacebookAuthProvider();
    provider.addScope('email');
    return finishSignIn(await signInWithPopup(auth, provider));
  }, [finishSignIn]);

  const logout = useCallback(async () => {
    setAuthError('');
    if (auth) await signOut(auth);
    setFirebaseUser(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      firebaseUser,
      loading,
      authError,
      getIdToken: firebaseUser ? getIdToken : null,
      refreshProfile,
      updateUserProfile,
      loginWithEmail,
      resetPassword,
      finishCustomTokenSignIn,
      loginWithGoogle,
      loginWithFacebook,
      logout,
    }),
    [
      authError,
      firebaseUser,
      getIdToken,
      loading,
      finishCustomTokenSignIn,
      loginWithEmail,
      loginWithFacebook,
      loginWithGoogle,
      logout,
      refreshProfile,
      resetPassword,
      updateUserProfile,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}

export function getRoleHomePath(role) {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'pastor':
      return '/pastor';
    case 'member':
      return '/profile';
    default:
      return '/login';
  }
}
