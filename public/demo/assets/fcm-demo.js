import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getMessaging,
  getToken,
  isSupported,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

const form = document.getElementById('fcmForm');
const tokenOutput = document.getElementById('tokenOutput');
const statusText = document.getElementById('statusText');
const copyButton = document.getElementById('copyToken');

function setStatus(message) {
  statusText.textContent = message;
}

function getTrimmedValue(name) {
  const field = form.elements.namedItem(name);
  return field && 'value' in field ? String(field.value || '').trim() : '';
}

async function resolveMessagingSupport() {
  try {
    return await isSupported();
  } catch (_error) {
    return false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  tokenOutput.value = '';
  setStatus('Checking browser support...');

  const supported = await resolveMessagingSupport();
  if (!supported) {
    setStatus('Firebase Messaging is not supported in this browser.');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setStatus('Notification permission was not granted.');
    return;
  }

  const firebaseConfig = {
    apiKey: getTrimmedValue('apiKey'),
    authDomain: getTrimmedValue('authDomain'),
    projectId: getTrimmedValue('projectId'),
    storageBucket: getTrimmedValue('storageBucket'),
    messagingSenderId: getTrimmedValue('messagingSenderId'),
    appId: getTrimmedValue('appId'),
  };
  const vapidKey = getTrimmedValue('vapidKey');

  try {
    setStatus('Registering service worker...');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    setStatus('Initializing Firebase app...');
    const app = initializeApp(firebaseConfig);
    const messaging = getMessaging(app);

    setStatus('Requesting FCM token...');
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      setStatus('No token received. Verify VAPID key and Firebase web setup.');
      return;
    }

    tokenOutput.value = token;
    setStatus('FCM token generated successfully.');
  } catch (error) {
    setStatus(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
});

copyButton.addEventListener('click', async () => {
  if (!tokenOutput.value.trim()) {
    setStatus('No token to copy.');
    return;
  }

  try {
    await navigator.clipboard.writeText(tokenOutput.value.trim());
    setStatus('Token copied to clipboard.');
  } catch (error) {
    setStatus(`Copy failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});
