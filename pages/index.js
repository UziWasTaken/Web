import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { FiSettings, FiExternalLink } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { FaDiscord } from 'react-icons/fa';
import { SiRoblox } from 'react-icons/si';

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
};

// Initialize Firebase only on client side
let auth = null;
if (typeof window !== 'undefined') {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export default function Home() {
  const [user, setUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        setUser(user);
      });
      return () => unsubscribe();
    }
  }, []);

  const signInWithGoogle = async () => {
    try {
      if (auth) {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const joinDiscord = () => {
    window.open('https://discord.gg/CUcRgdEVZv', '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 to-purple-900/20" />
      
      {/* Settings Button */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 rounded-full hover:bg-gray-800 transition-colors"
        >
          <FiSettings className="w-6 h-6 text-gray-300" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 bg-gray-800 p-4 rounded-lg shadow-xl z-10 animate-slide-in">
          <h3 className="font-semibold mb-2 text-gray-200">Settings</h3>
          <div className="space-y-2">
            <p className="text-gray-400">Version: 1.0.0</p>
            {user && (
              <button
                onClick={handleSignOut}
                className="w-full py-2 px-4 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8 animate-float">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 mb-2">
            BYTE
          </h1>
          <p className="text-gray-400">Ultimate BladeBall Script</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-gray-700/50">
          {!user ? (
            <div className="space-y-4 animate-slide-in">
              <button
                onClick={signInWithGoogle}
                className="w-full flex items-center justify-center gap-2 bg-white/10 backdrop-blur border border-white/10 rounded-lg px-6 py-3 text-white hover:bg-white/20 transition-colors"
              >
                <FcGoogle className="w-6 h-6" />
                Sign in with Google
              </button>
              
              <div className="relative py-3">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-2 bg-gray-800/50 text-sm text-gray-400">or continue with</span>
                </div>
              </div>

              <button
                onClick={joinDiscord}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 rounded-lg px-6 py-3 text-white hover:bg-indigo-700 transition-colors animate-pulse-slow"
              >
                <FaDiscord className="w-6 h-6" />
                Join Discord
              </button>

              <a
                href="https://www.roblox.com/games/13772394625/Blade-Ball"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-gray-700 rounded-lg px-6 py-3 text-white hover:bg-gray-600 transition-colors"
              >
                <SiRoblox className="w-6 h-6" />
                Play BladeBall
                <FiExternalLink className="w-4 h-4 ml-1" />
              </a>
            </div>
          ) : (
            <div className="text-center animate-slide-in">
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-indigo-500"
              />
              <h2 className="text-xl font-semibold text-white">{user.displayName}</h2>
              <p className="text-gray-400 mb-4">{user.email}</p>
              <button
                onClick={joinDiscord}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 rounded-lg px-6 py-3 text-white hover:bg-indigo-700 transition-colors mt-4 animate-pulse-slow"
              >
                <FaDiscord className="w-6 h-6" />
                Join Discord to Access Byte
              </button>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-2 gap-4 animate-slide-in">
          <div className="bg-gray-800/50 backdrop-blur p-4 rounded-lg border border-gray-700/50">
            <h3 className="font-semibold text-indigo-400">Auto Parry</h3>
            <p className="text-sm text-gray-400">Advanced parry prediction system</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur p-4 rounded-lg border border-gray-700/50">
            <h3 className="font-semibold text-purple-400">Custom Abilities</h3>
            <p className="text-sm text-gray-400">Unlock special moves</p>
          </div>
        </div>
      </div>
    </div>
  );
} 