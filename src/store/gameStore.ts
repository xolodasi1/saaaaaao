import { create } from 'zustand';

export interface PlayerData {
  id: string;
  nickname: string;
  level: number;
  hp: number;
  maxHp: number;
  position: { x: number, y: number, z: number };
  isAttacking?: boolean;
}

interface GameState {
  me: PlayerData | null;
  players: Record<string, PlayerData>;
  socket: WebSocket | null;
  serverUrl: string;
  
  setMe: (player: PlayerData) => void;
  setPlayers: (players: PlayerData[]) => void;
  updatePlayer: (id: string, data: Partial<PlayerData>) => void;
  removePlayer: (id: string) => void;
  connectSocket: (url: string, playerId: string) => void;
  disconnectSocket: () => void;
  moveMe: (position: { x: number, y: number, z: number }) => void;
  attack: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  me: null,
  players: {}, // Using an object for O(1) lookup
  socket: null,
  serverUrl: '',

  setMe: (player) => set({ me: player }),
  
  setPlayers: (playersArray) => {
    const playersObj: Record<string, PlayerData> = {};
    playersArray.forEach(p => {
      // Don't add ourselves to the remote players list
      if (p.id !== get().me?.id) {
        playersObj[p.id] = p;
      }
    });
    set({ players: playersObj });
  },

  updatePlayer: (id, data) => set(state => {
    if (state.me?.id === id) {
       return { me: { ...state.me, ...data } };
    }
    if (state.players[id]) {
       return { players: { ...state.players, [id]: { ...state.players[id], ...data } } };
    }
    return state;
  }),

  removePlayer: (id) => set(state => {
    const newPlayers = { ...state.players };
    delete newPlayers[id];
    return { players: newPlayers };
  }),

  connectSocket: (url, playerId) => {
    // Prevent multiple connections
    if (get().socket) return;
    
    // In dev, use ws protocol based on location
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/game`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("Connected to game server");
      ws.send(JSON.stringify({
        type: 'connect',
        payload: { playerId }
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const state = get();

      switch(data.type) {
         case 'init':
           state.setPlayers(data.payload.players);
           break;
         case 'player_joined':
           if (data.payload.id !== state.me?.id) {
               state.updatePlayer(data.payload.id, data.payload);
           }
           break;
         case 'player_moved':
           state.updatePlayer(data.payload.id, { position: data.payload.position });
           break;
         case 'player_left':
           state.removePlayer(data.payload.id);
           break;
         case 'player_attacked':
           // Set attack animation state briefly
           state.updatePlayer(data.payload.id, { isAttacking: true });
           setTimeout(() => {
               state.updatePlayer(data.payload.id, { isAttacking: false });
           }, 500); // 500ms attack animation length
           break;
         case 'player_damaged':
           state.updatePlayer(data.payload.targetId, { hp: data.payload.hp });
           // Could also spawn damage numbers here
           break;
         case 'player_respawned':
           state.updatePlayer(data.payload.id, { 
               hp: data.payload.hp, 
               position: data.payload.position 
           });
           break;
      }
    };

    ws.onclose = () => {
      console.log("Disconnected from server");
      set({ socket: null });
    };

    set({ socket: ws, serverUrl: wsUrl });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.close();
      set({ socket: null });
    }
  },

  moveMe: (position) => {
    const state = get();
    if (state.me && state.socket?.readyState === WebSocket.OPEN) {
       // Optimistic update locally
       state.setMe({ ...state.me, position });
       // Send to server
       state.socket.send(JSON.stringify({
          type: 'move',
          payload: { position }
       }));
    }
  },

  attack: () => {
      const state = get();
      if (state.me && state.socket?.readyState === WebSocket.OPEN) {
          // Set own attacking UI state locally
          state.setMe({ ...state.me, isAttacking: true });
          setTimeout(() => {
              const currentMe = get().me;
              if(currentMe) get().setMe({ ...currentMe, isAttacking: false });
          }, 500);

          // Tell server
          state.socket.send(JSON.stringify({
              type: 'attack'
          }));
      }
  }
}));
