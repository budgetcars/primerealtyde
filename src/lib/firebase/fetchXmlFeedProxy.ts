import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { getFirebaseApp, firebaseFunctionsRegion } from './client';

let functionsInstance: Functions | null = null;

function getFunctionsForProxy(): Functions {
	if (!functionsInstance) {
		functionsInstance = getFunctions(getFirebaseApp(), firebaseFunctionsRegion);
	}
	return functionsInstance;
}

type ProxyResponse = { body: string; bytes: number };

/**
 * Ruft die Callable Function `fetchXmlFeedProxy` auf (serverseitiger Abruf, umgeht CORS).
 * Erfordert angemeldeten Firebase-User.
 */
export async function fetchXmlFeedViaProxy(url: string): Promise<ProxyResponse> {
	const fn = httpsCallable<{ url: string }, ProxyResponse>(getFunctionsForProxy(), 'fetchXmlFeedProxy');
	const { data } = await fn({ url });
	if (!data || typeof data.body !== 'string') {
		throw new Error('Ungültige Antwort vom Feed-Proxy.');
	}
	return data;
}
