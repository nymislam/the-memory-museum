import * as THREE from 'three';

/** Shared materials: one instance each, reused by every mesh that needs it. */
export const GOLD = new THREE.MeshStandardMaterial({ color: '#C6A36B', metalness: 1, roughness: 0.28 });
export const GOLD_SOFT = new THREE.MeshStandardMaterial({ color: '#B8935A', metalness: 0.9, roughness: 0.45 });
export const BRONZE = new THREE.MeshStandardMaterial({ color: '#4A3525', metalness: 0.55, roughness: 0.5 });
export const STONE = new THREE.MeshStandardMaterial({ color: '#F1E8D8', metalness: 0.0, roughness: 0.38 });
export const CRYSTAL = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.95, roughness: 0.04, envMapIntensity: 2.2 });
export const FLAME = new THREE.MeshBasicMaterial({ color: '#FFE2A8', toneMapped: false });
