import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { PlayerCharacter } from './PlayerCharacter';

const SCENE_SIZE = 50;

// Input handler for movement
const MovementController: React.FC = () => {
    const speed = 5;
    const keys = useRef<{ [key: string]: boolean }>({});

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = true; };
        const onKeyUp = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
        
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, []);

    useFrame((state, delta) => {
        const store = useGameStore.getState();
        const me = store.me;
        if (!me || me.hp <= 0) return; // Can't move if dead

        let moveX = 0;
        let moveZ = 0;

        if (keys.current['w']) moveZ -= 1;
        if (keys.current['s']) moveZ += 1;
        if (keys.current['a']) moveX -= 1;
        if (keys.current['d']) moveX += 1;

        if (keys.current[' ']) {
            // Space to attack
            keys.current[' '] = false; // Prevent holding
            store.attack();
        }

        if (moveX !== 0 || moveZ !== 0) {
            // Normalize so diagonal movement isn't faster
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            moveX = (moveX / length) * speed * delta;
            moveZ = (moveZ / length) * speed * delta;

            const newX = Math.max(-SCENE_SIZE/2, Math.min(SCENE_SIZE/2, me.position.x + moveX));
            const newZ = Math.max(-SCENE_SIZE/2, Math.min(SCENE_SIZE/2, me.position.z + moveZ));
            
            // Only send update if actually moved
            if (newX !== me.position.x || newZ !== me.position.z) {
               store.moveMe({ x: newX, y: 0, z: newZ });
               // Also smooth local camera a bit by looking at the player target manually if we want
            }
        }
    });

    return null;
};

// Decorative objects
const EnvironmentDecorations = () => {
    // Generate some random trees
    const trees = useMemo(() => {
        const arr = [];
        for (let i = 0; i < 40; i++) {
            const x = (Math.random() - 0.5) * SCENE_SIZE;
            const z = (Math.random() - 0.5) * SCENE_SIZE;
            // don't spawn exactly in middle
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
            arr.push({ x, z, scale: 0.5 + Math.random() * 0.5 });
        }
        return arr;
    }, []);

    return (
        <group>
            {trees.map((t, i) => (
                <group key={i} position={[t.x, 0, t.z]} scale={t.scale}>
                    <mesh position={[0, 1, 0]}>
                        <cylinderGeometry args={[0.2, 0.2, 2]} />
                        <meshStandardMaterial color="#5c4033" />
                    </mesh>
                    <mesh position={[0, 2.5, 0]}>
                        <coneGeometry args={[1.5, 3, 5]} />
                        <meshStandardMaterial color="#166534" />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

// Separate component for rendering players to avoid re-rendering GameScene
const PlayersRenderer = () => {
    const me = useGameStore(state => state.me);
    const players = useGameStore(state => state.players);
    
    return (
        <>
            {me && <PlayerCharacter player={me} isMe={true} />}
            {Object.values(players).map(p => (
                <PlayerCharacter key={p.id} player={p} />
            ))}
        </>
    );
};

// Separate component for camera
const FollowCamera = () => {
    const mePos = useGameStore(state => state.me?.position);
    
    return (
        <OrbitControls 
            target={mePos ? [mePos.x, 0, mePos.z] : [0, 0, 0]}
            minDistance={5}
            maxDistance={20}
            maxPolarAngle={Math.PI / 2 - 0.1}
        />
    );
};

const HUD = () => {
    const me = useGameStore(state => state.me);
    const players = useGameStore(state => state.players);

    return (
        <>
            {/* OVERLAY HUD (SAO STYLE) */}
            <div className="absolute inset-0 z-10 p-8 flex flex-col pointer-events-none font-sans text-slate-100 uppercase">
                {/* TOP LEFT: PLAYER STATS */}
                {me && (
                <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-white/80 bg-slate-800 shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center overflow-hidden">
                    <div className="text-2xl font-bold text-white uppercase">{me.nickname.charAt(0).toUpperCase()}</div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-end gap-3">
                    <span className="text-2xl font-bold tracking-widest text-white drop-shadow-md uppercase">{me.nickname}</span>
                    <span className="text-xs bg-white text-black px-1.5 font-black mb-1">LV. {me.level}</span>
                    </div>
                    {/* HP BAR */}
                    <div className="relative w-80 h-4 bg-slate-900/80 border border-white/20 skew-x-[-20deg]">
                    <div className={`absolute inset-y-0 left-0 bg-gradient-to-r shadow-[0_0_10px_#4ade80] transition-all duration-300 ${me.hp > 30 ? 'from-green-400 to-emerald-500' : 'from-red-500 to-rose-600'}`} style={{ width: `${Math.max(0, (me.hp / me.maxHp) * 100)}%` }}></div>
                    <div className="absolute -right-16 top-0 text-[10px] font-bold text-white/90 skew-x-[20deg]">{me.hp} / {me.maxHp}</div>
                    </div>
                </div>
                </div>
                )}

                {/* TOP RIGHT: SERVER & DB STATUS */}
                <div className="absolute top-8 right-8 flex flex-col gap-2 items-end">
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 border-r-4 border-cyan-500">
                    <div className="flex flex-col items-end">
                    <span className="text-[10px] text-cyan-400 font-bold tracking-tighter uppercase">Appwrite Cloud</span>
                    <span className="text-xs font-mono normal-case">fra-69eba0d600105d8b9d90</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
                </div>
                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2 border-r-4 border-emerald-500">
                    <div className="flex flex-col items-end">
                    <span className="text-[10px] text-emerald-400 font-bold tracking-tighter uppercase">WebSocket Service</span>
                    <span className="text-xs font-mono normal-case">Latency: &lt;50ms</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                </div>
                </div>

                {/* CENTER BOTTOM: ABILITY HOTBAR */}
                <div className="mt-auto mb-4 self-center flex gap-3 normal-case">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-lg border border-white/30 flex items-center justify-center text-xs rotate-45">
                    <div className="-rotate-45 font-bold tracking-tighter text-center leading-none">WASD<br/><span className="text-[8px] opacity-50 font-normal">MOVE</span></div>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-lg border border-white/50 flex items-center justify-center text-xs rotate-45 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    <div className="-rotate-45 font-bold flex flex-col items-center leading-none"><span>SPC</span><span className="text-[8px] opacity-70 mt-1 font-normal">ATTACK</span></div>
                </div>
                <div className="w-12 h-12 bg-white/10 backdrop-blur-lg border border-white/30 flex items-center justify-center text-xs rotate-45">
                    <div className="-rotate-45 font-bold tracking-tighter text-center leading-none">DRAG<br/><span className="text-[8px] opacity-50 font-normal">CAM</span></div>
                </div>
                </div>

                {/* BOTTOM RIGHT: SYSTEM ARCHITECTURE LOG */}
                <div className="absolute bottom-8 right-8 w-72 bg-black/60 backdrop-blur-xl border-t border-l border-white/10 p-4 font-mono text-[10px] text-slate-400 normal-case">
                <div className="text-cyan-400 mb-2 border-b border-cyan-400/30 pb-1 tracking-wider">[ARCHITECTURE_MONITOR]</div>
                <div className="space-y-1">
                    <p>&gt; <span className="text-emerald-400">AUTH</span>: Appwrite session verified</p>
                    <p>&gt; <span className="text-emerald-400">WS</span>: Connected to /v1/realtime</p>
                    <p>&gt; <span className="text-white">DATA</span>: Fetching collection 'players'</p>
                    <p>&gt; <span className="text-white">POS</span>: Synchronizing {me ? `{x: ${me.position.x.toFixed(1)}, z: ${me.position.z.toFixed(1)}}` : '...'}</p>
                    <p>&gt; <span className="text-orange-400">SYNC</span>: {Object.keys(players).length} Peer(s) updated</p>
                    <p className="mt-2 text-white animate-pulse">_ awaiting input...</p>
                </div>
                </div>

                {/* LEFT SIDE: PARTY INFO */}
                <div className="absolute top-32 left-8 flex flex-col gap-4">
                {Object.values(players).map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 max-w-[150px]">
                    <div className={`w-1 h-8 ${i % 2 === 0 ? 'bg-cyan-400' : 'bg-slate-500'}`}></div>
                    <div className="flex flex-col ml-1">
                        <span className="text-xs font-bold uppercase truncate">{p.nickname}</span>
                        <div className="w-24 h-1.5 bg-slate-800 border border-white/10 mt-1">
                        <div className={`h-full transition-all duration-300 ${p.hp > 30 ? 'bg-emerald-400' : 'bg-red-500'}`} style={{ width: `${Math.max(0, (p.hp / p.maxHp) * 100)}%` }}></div>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            </div>
            
            {me && me.hp <= 0 && (
                <div className="absolute inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center pointer-events-none z-50">
                    <h1 className="text-6xl font-bold text-red-500 tracking-widest uppercase drop-shadow-lg">You Died</h1>
                    <p className="absolute mt-24 text-white text-xl uppercase tracking-widest">Respawning soon...</p>
                </div>
            )}
        </>
    );
};

export const GameScene: React.FC = () => {
    return (
        <div className="w-screen h-screen relative" tabIndex={0} autoFocus>
            <Canvas shadows camera={{ position: [0, 10, 15], fov: 50 }}>
                <Sky sunPosition={[100, 20, 100]} />
                <ambientLight intensity={0.3} />
                <directionalLight 
                    castShadow 
                    position={[10, 20, 10]} 
                    intensity={1.5} 
                    shadow-mapSize={[1024, 1024]}
                />

                {/* Ground */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
                    <planeGeometry args={[SCENE_SIZE + 20, SCENE_SIZE + 20]} />
                    <meshStandardMaterial color="#2f855a" /> {/* Grass green */}
                </mesh>

                {/* Grid helper for visual ground */}
                <gridHelper args={[SCENE_SIZE, SCENE_SIZE, "#15803d", "#14532d"]} position={[0, 0.01, 0]} />

                <EnvironmentDecorations />

                <PlayersRenderer />
                <MovementController />
                <FollowCamera />
            </Canvas>

            <HUD />

            {/* AMBIENT EFFECTS */}
            <div className="absolute inset-0 pointer-events-none z-[5]">
                <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_0%,rgba(0,0,0,0.4)_100%)]"></div>
                {/* Light Rays */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-white/10 to-transparent blur-[120px] rounded-full"></div>
            </div>
        </div>
    );
};
