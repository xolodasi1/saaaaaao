/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { LoginScreen } from './components/LoginScreen';
import { GameScene } from './components/GameScene';

export default function App() {
  // Only subscribe to the boolean to avoid re-rendering the entire app on position updates
  const isLoggedIn = useGameStore(state => !!state.me);
  
  const meId = useGameStore(state => state.me?.id);
  const connectSocket = useGameStore(state => state.connectSocket);
  const disconnectSocket = useGameStore(state => state.disconnectSocket);

  useEffect(() => {
    if (meId) {
      connectSocket('', meId);
    } else {
      disconnectSocket();
    }
  }, [meId, connectSocket, disconnectSocket]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black font-sans text-white">
      {!isLoggedIn ? <LoginScreen /> : <GameScene />}
    </div>
  );
}
