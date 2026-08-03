import { initializeApp } from "firebase/app"
import { initializeFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyAk59700xi8LMAkmkypAD59veIpBNEThhU",
  authDomain: "sayartech-871ac.firebaseapp.com",
  projectId: "sayartech-871ac",
  storageBucket: "sayartech-871ac.appspot.com",
  messagingSenderId: "765625725930",
  appId: "1:765625725930:web:cc1f85af0bcbf2e6c83893"
};

const app = initializeApp(firebaseConfig)
export const DB = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
})
export const STORAGE = getStorage(app)