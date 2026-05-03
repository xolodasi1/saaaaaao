import express from 'express';
import { createServer as createViteServer } from 'vite';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { Client, Databases, ID, Query } from 'node-appwrite';

// ----------------------------------------------------
// Constants & Configuration
// ----------------------------------------------------
const PORT = 3000;
const APPWRITE_ENDPOINT = 'https://cloud.appwrite.io/v1';
const APPWRITE_PROJECT = 'fra-69eba0d600105d8b9d90';

// In a real app, define these in .env
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY || ''; 
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'sao_rpg_db';
const PLAYERS_COLLECTION_ID = process.env.APPWRITE_PLAYERS_COLLECTION || 'players';
const SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION || 'sessions';

// ----------------------------------------------------
// Appwrite Setup (Backend)
// ----------------------------------------------------
const appwriteClient = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT);

if (APPWRITE_API_KEY) {
    appwriteClient.setKey(APPWRITE_API_KEY);
}

const db = new Databases(appwriteClient);

// ----------------------------------------------------
// In-Memory Game State
// ----------------------------------------------------
interface Player {
  id: string;
  nickname: string;
  level: number;
  hp: number;
  maxHp: number;
  position: { x: number, y: number, z: number };
  inventory: any[];
}

const gameState = {
  players: new Map<string, Player>(),    // Active players
  sockets: new Map<string, WebSocket>()  // Connected sockets by player ID
};

async function startServer() {
  const app = express();
  app.use(express.json());

  // ----------------------------------------------------
  // ReST API Routes
  // ----------------------------------------------------
  
  // POST /login - Creates or fetches a player 
  app.post('/api/login', async (req, res) => {
    const { nickname } = req.body;
    
    if (!nickname) {
      res.status(400).json({ error: 'Nickname is required' });
      return;
    }

    try {
      let player: Player | null = null;
      let playerId = '';

      // Try Appwrite integration
      if (APPWRITE_API_KEY) {
        try {
          const result = await db.listDocuments(DATABASE_ID, PLAYERS_COLLECTION_ID, [
            Query.equal('nickname', nickname)
          ]);
          
          if (result.documents.length > 0) {
            const doc = result.documents[0];
            playerId = doc.userId;
            player = {
              id: doc.userId,
              nickname: doc.nickname,
              level: doc.level,
              hp: doc.hp,
              maxHp: 100,
              position: JSON.parse(doc.position),
              inventory: JSON.parse(doc.inventory || '[]'),
            };
          } else {
            // Create new player
            playerId = ID.unique();
            const initialPos = { x: Math.random() * 10 - 5, y: 0, z: Math.random() * 10 - 5 };
            const doc = await db.createDocument(DATABASE_ID, PLAYERS_COLLECTION_ID, ID.unique(), {
              userId: playerId,
              nickname,
              level: 1,
              hp: 100,
              position: JSON.stringify(initialPos),
              inventory: JSON.stringify([])
            });
            player = {
              id: playerId,
              nickname,
              level: 1,
              hp: 100,
              maxHp: 100,
              position: initialPos,
              inventory: []
            };
          }
        } catch (dbError: any) {
          if (dbError?.code === 404 || dbError?.message?.includes('could not be found')) {
            console.log("Appwrite project/database not found or not configured. Falling back to in-memory game state.");
          } else {
            console.error("Appwrite DB error:", dbError?.message || dbError);
          }
          // Fallback to in-memory
        }
      }

      // In-memory fallback if Appwrite is not reachable
      if (!player) {
         playerId = 'usr_' + Math.random().toString(36).substr(2, 9);
         player = {
           id: playerId,
           nickname,
           level: 1,
           hp: 100,
           maxHp: 100,
           position: { x: Math.random() * 10 - 5, y: 0, z: Math.random() * 10 - 5 },
           inventory: []
         };
      }

      // Add to server memory
      gameState.players.set(playerId, player);
      res.json({ player });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // GET /player - Fetch offline player data example
  app.get('/api/player/:id', async (req, res) => {
    const { id } = req.params;
    const player = gameState.players.get(id);
    if (player) {
       res.json({ player });
       return;
    }
    // Attempt DB fetch
    try {
        if (APPWRITE_API_KEY) {
            const result = await db.listDocuments(DATABASE_ID, PLAYERS_COLLECTION_ID, [
                Query.equal('userId', id)
            ]);
            if (result.documents.length > 0) res.json({ player: result.documents[0] });
            else res.status(404).json({ error: 'Player not found' });
            return;
        }
    } catch(e) {}
    
    res.status(404).json({ error: 'Player not found' });
  });

  // ----------------------------------------------------
  // Vite Middleware (Frontend serving)
  // ----------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // ----------------------------------------------------
  // WebSocket Server (Multiplayer Logic)
  // ----------------------------------------------------
  const wss = new WebSocketServer({ server, path: '/game' });

  wss.on('connection', (ws) => {
    let currentPlayerId: string | null = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        switch (data.type) {
          case 'connect': {
            const { playerId } = data.payload;
            if (gameState.players.has(playerId)) {
              currentPlayerId = playerId;
              gameState.sockets.set(playerId, ws);

              // Send current state of all players to the newly connected player
              ws.send(JSON.stringify({
                type: 'init',
                payload: {
                  players: Array.from(gameState.players.values())
                }
              }));

              // Broadcast everyone else that this player has joined
              const me = gameState.players.get(playerId);
              broadcastExcept(ws, {
                type: 'player_joined',
                payload: me
              });
            }
            break;
          }
          case 'move': {
            if (currentPlayerId && gameState.players.has(currentPlayerId)) {
              const { position } = data.payload;
              const player = gameState.players.get(currentPlayerId)!;
              player.position = position;

              // Broadcast move to other players
              broadcastExcept(ws, {
                type: 'player_moved',
                payload: {
                  id: currentPlayerId,
                  position
                }
              });
            }
            break;
          }
          case 'attack': {
               if (currentPlayerId && gameState.players.has(currentPlayerId)) {
                   const attacker = gameState.players.get(currentPlayerId)!;
                   
                   // Broadcast the attack animation
                   broadcastExcept(ws, {
                       type: 'player_attacked',
                       payload: { id: currentPlayerId }
                   });

                   // Simple distance-based hit detection
                   const attackRange = 2.5; 
                   const damage = 15;

                   Array.from(gameState.players.values()).forEach(target => {
                       if (target.id === currentPlayerId) return; // Can't hit self
                       if (target.hp <= 0) return; // Can't hit dead

                       const dx = target.position.x - attacker.position.x;
                       const dz = target.position.z - attacker.position.z;
                       const dist = Math.sqrt(dx*dx + dz*dz);

                       if (dist <= attackRange) {
                           target.hp -= damage;
                           if (target.hp < 0) target.hp = 0;

                           // Broadcast damage taken
                           broadcastAll({
                               type: 'player_damaged',
                               payload: {
                                   targetId: target.id,
                                   attackerId: attacker.id,
                                   damage: damage,
                                   hp: target.hp
                               }
                           });

                           // Handle death
                           if (target.hp === 0) {
                               setTimeout(() => {
                                   respawnPlayer(target.id);
                               }, 3000);
                           }
                       }
                   });
               }
               break;
          }
        }
      } catch (err) {
        console.error("WS error:", err);
      }
    });

    ws.on('close', () => {
      if (currentPlayerId) {
        gameState.sockets.delete(currentPlayerId);
        // We could also remove from players map if we want them to disappear
        gameState.players.delete(currentPlayerId);
        broadcastAll({
          type: 'player_left',
          payload: { id: currentPlayerId }
        });
      }
    });
  });

  function broadcastAll(messageObj: any) {
    const msg = JSON.stringify(messageObj);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  function broadcastExcept(sender: WebSocket, messageObj: any) {
    const msg = JSON.stringify(messageObj);
    wss.clients.forEach(client => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }

  function respawnPlayer(playerId: string) {
     const p = gameState.players.get(playerId);
     if (p) {
         p.hp = p.maxHp;
         p.position = { x: Math.random() * 10 - 5, y: 0, z: Math.random() * 10 - 5 };
         broadcastAll({
             type: 'player_respawned',
             payload: p
         });
     }
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Sword Art Online Prototype Server running on port ${PORT}`);
  });
}

startServer();
