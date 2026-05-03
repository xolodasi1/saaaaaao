import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { PlayerData, useGameStore } from '../store/gameStore';

interface PlayerCharacterProps {
  player: PlayerData;
  isMe?: boolean;
}

export const PlayerCharacter: React.FC<PlayerCharacterProps> = ({ player, isMe }) => {
    const groupRef = useRef<THREE.Group>(null);
    const swordPivotRef = useRef<THREE.Group>(null);
    const targetPos = useRef(new THREE.Vector3(player.position.x, player.position.y, player.position.z));
    
    // For not 'isMe', keep `targetPos` updated from props without creating new references
    if (!isMe) {
        targetPos.current.set(player.position.x, player.position.y, player.position.z);
    }

    useFrame((state, delta) => {
        if (isMe) {
             // For the local player, we fetch position directly from store to avoid prop drill re-renders
             const currentMe = useGameStore.getState().me;
             if (currentMe && groupRef.current) {
                 groupRef.current.position.set(currentMe.position.x, currentMe.position.y, currentMe.position.z);
                 
                 // Handle attack animation using current state
                 if (swordPivotRef.current) {
                     if (currentMe.isAttacking) {
                         swordPivotRef.current.rotation.x = THREE.MathUtils.lerp(swordPivotRef.current.rotation.x, -Math.PI / 2, delta * 20);
                     } else {
                         swordPivotRef.current.rotation.x = THREE.MathUtils.lerp(swordPivotRef.current.rotation.x, Math.PI / 8, delta * 10);
                     }
                 }
             }
        } else {
             if (groupRef.current) {
                 // Lerp towards target position for remote players to smooth out network stutters
                 groupRef.current.position.lerp(targetPos.current, delta * 15);
                 
                 // simple look at logic (assuming they look where they move)
                 if (groupRef.current.position.distanceTo(targetPos.current) > 0.05) {
                     // Determine direction
                     const lookDir = targetPos.current.clone().sub(groupRef.current.position).normalize();
                     const targetRotation = Math.atan2(lookDir.x, lookDir.z);
                     
                     // Keep y locked
                     groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, delta * 10);
                 }
             }
             
             if (swordPivotRef.current) {
                 if (player.isAttacking) {
                     swordPivotRef.current.rotation.x = THREE.MathUtils.lerp(swordPivotRef.current.rotation.x, -Math.PI / 2, delta * 20);
                 } else {
                     swordPivotRef.current.rotation.x = THREE.MathUtils.lerp(swordPivotRef.current.rotation.x, Math.PI / 8, delta * 10);
                 }
             }
        }
    });

    const isDead = player.hp <= 0;

    return (
        <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
            {/* Health Bar & Name (Billboard ensures it always faces camera) */}
            <Billboard position={[0, 2.5, 0]}>
                {/* Name */}
                <Text fontSize={0.3} color={isMe ? "#4ade80" : "white"} anchorY="bottom" outlineWidth={0.02} outlineColor="#000">
                    {`[Lv.${player.level}] ${player.nickname}`}
                </Text>
                
                {/* HP Bar Background */}
                <mesh position={[0, -0.2, 0]}>
                    <planeGeometry args={[1.5, 0.1]} />
                    <meshBasicMaterial color="#333" />
                </mesh>
                
                {/* HP Bar Fill */}
                <mesh position={[-0.75 + ((player.hp / player.maxHp) * 1.5) / 2, -0.2, 0.01]}>
                    <planeGeometry args={[Math.max(0, (player.hp / player.maxHp) * 1.5), 0.1]} />
                    <meshBasicMaterial color={player.hp > 30 ? "#22c55e" : "#ef4444"} />
                </mesh>
            </Billboard>

            {/* Character Body */}
            <group rotation={[isDead ? -Math.PI/2 : 0, 0, 0]} position={[0, isDead ? 0.5 : 1, 0]}>
                {/* Head */}
                <mesh position={[0, 0.7, 0]}>
                    <boxGeometry args={[0.6, 0.6, 0.6]} />
                    <meshStandardMaterial color={isMe ? "#3b82f6" : "#f43f5e"} />
                </mesh>
                
                {/* Torso */}
                <mesh position={[0, -0.1, 0]}>
                    <boxGeometry args={[0.8, 1.0, 0.4]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>

                {/* Sword */}
                {!isDead && (
                    <group ref={swordPivotRef} position={[0.5, 0, 0]} rotation={[Math.PI / 8, 0, 0]}>
                        <mesh position={[0, 0.7, 0.2]}>
                            <boxGeometry args={[0.1, 1.4, 0.2]} />
                            <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
                        </mesh>
                        <mesh position={[0, 0, 0.2]}>
                            <boxGeometry args={[0.3, 0.1, 0.3]} />
                            <meshStandardMaterial color="#b45309" />
                        </mesh>
                    </group>
                )}
            </group>
        </group>
    );
};
