import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
	apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY as string | undefined,
	authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined,
	projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
	storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET as string | undefined,
	messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
	appId: import.meta.env.PUBLIC_FIREBASE_APP_ID as string | undefined,
};

export function isFirebaseConfigured(): boolean {
	return Boolean(
		cfg.apiKey &&
			cfg.authDomain &&
			cfg.projectId &&
			cfg.storageBucket &&
			cfg.messagingSenderId &&
			cfg.appId
	);
}

let app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
	if (!isFirebaseConfigured()) {
		throw new Error('Firebase Umgebungsvariablen fehlen.');
	}
	if (!app) {
		const existing = getApps();
		app = existing.length ? existing[0]! : initializeApp(cfg as Required<typeof cfg>);
	}
	return app;
}

export function getDb() {
	return getFirestore(getFirebaseApp());
}

export function getFirebaseAuth() {
	return getAuth(getFirebaseApp());
}

/** Region für Callable Functions (z. B. `fetchXmlFeedProxy`). Muss mit Deploy-Region übereinstimmen. */
export const firebaseFunctionsRegion =
	(import.meta.env.PUBLIC_FIREBASE_FUNCTIONS_REGION as string | undefined)?.trim() || 'europe-west1';
