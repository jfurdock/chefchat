import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import { getFirestore } from '@react-native-firebase/firestore';
import { getFunctions } from '@react-native-firebase/functions';

// React Native Firebase auto-initializes from google-services.json / GoogleService-Info.plist
// No manual config needed — just import and use the modules.

const app = getApp();
const auth = getAuth(app);
const firestore = getFirestore(app);
const functions = getFunctions(app);

export { app, auth, firestore, functions };
