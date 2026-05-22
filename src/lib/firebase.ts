import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Core Firebase auth instance used by Firestore internally
const realAuth = getAuth(app);

// Mock authentication system for local/unauthorized-domain emergency access
let mockUserObj: any = null;

try {
  const saved = localStorage.getItem('boxing_app_mock_user');
  if (saved) {
    mockUserObj = JSON.parse(saved);
  }
} catch (e) {
  console.error("Failed to parse mock user:", e);
}

export const setMockUser = (user: any) => {
  mockUserObj = user;
  if (user) {
    localStorage.setItem('boxing_app_mock_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('boxing_app_mock_user');
  }
  // Notify App.tsx or any other listeners about the simulated auth change
  window.dispatchEvent(new Event('mock-auth-changed'));
};

// Export a Proxy wrapper that satisfies our UI files with the mock user, 
// but leaves the core realAuth object undisturbed for Firebase SDK internals (preventing proactive-refresh crashes).
export const auth = new Proxy(realAuth, {
  get(target, prop, receiver) {
    if (prop === 'currentUser') {
      return mockUserObj || target.currentUser;
    }
    const val = Reflect.get(target, prop, receiver);
    if (typeof val === 'function') {
      return val.bind(target);
    }
    return val;
  }
});
