<script lang="ts">
	import { T, useThrelte } from '@threlte/core';
	import { onMount } from 'svelte';
	import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
	// Import necessary types for type guards and helpers
	import { PointLightHelper, SpotLightHelper } from 'three';
	import type { Object3D, Light, Mesh, PointLight, SpotLight } from 'three';

	let sceneModelPath = $state<string | null>(null); // Start with null, wait for API

	const { scene } = useThrelte();
	let sceneModel: Object3D | null = null;

	const spotLightAngle = Math.PI / 3;

	// Refs for the point lights
	let pointLight1Ref = $state<PointLight | undefined>(undefined);
	let pointLight2Ref = $state<PointLight | undefined>(undefined);

	// Ref for the spotlight
	let spotLightRef = $state<SpotLight | undefined>(undefined);

	// Effect to add/remove helpers
	$effect(() => {
		let pHelper1: PointLightHelper | undefined;
		let pHelper2: PointLightHelper | undefined;
		let sHelper: SpotLightHelper | undefined;

		if (pointLight1Ref) {
			pHelper1 = new PointLightHelper(pointLight1Ref, 0.5); // Second arg is sphere size
			scene.add(pHelper1);
			console.log('[SceneModel] Added helper for point light 1');
		}
		if (pointLight2Ref) {
			pHelper2 = new PointLightHelper(pointLight2Ref, 0.5);
			scene.add(pHelper2);
			console.log('[SceneModel] Added helper for point light 2');
		}
		if (spotLightRef) {
			sHelper = new SpotLightHelper(spotLightRef);
			scene.add(sHelper);
			console.log('[SceneModel] Added helper for spotlight');
		}

		// Cleanup function
		return () => {
			if (pHelper1) {
				scene.remove(pHelper1);
				pHelper1.dispose(); // Dispose helper resources
				console.log('[SceneModel] Removed helper for point light 1');
			}
			if (pHelper2) {
				scene.remove(pHelper2);
				pHelper2.dispose();
				console.log('[SceneModel] Removed helper for point light 2');
			}
			if (sHelper) {
				scene.remove(sHelper);
				sHelper.dispose();
				console.log('[SceneModel] Removed helper for spotlight');
			}
		};
	});

	async function loadSceneModel(path: string) {
		const loader = new GLTFLoader();
		try {
			console.log('[SceneModel] Loading scene model from:', path);

			// Remove previous scene model if it exists
			if (sceneModel && scene.children.includes(sceneModel)) {
				scene.remove(sceneModel);
			}

			const gltf = await loader.loadAsync(path);
			console.log('[SceneModel] Loaded scene model structure:', gltf.scene);
			sceneModel = gltf.scene;
			sceneModel.position.set(0, -0.5, 0);
			sceneModel.scale.set(0.08, 0.08, 0.08);

			// Traverse the loaded scene to check for and potentially adjust lights
			sceneModel.traverse((child) => {
				// Use type guards
				if ((child as Light).isLight) {
					console.log('[SceneModel] Found light in GLTF:', child);
					// Adjust intensity or enable shadows if needed, though adding scene lights is often better
				}
				// Use type guards
				if ((child as Mesh).isMesh) {
					// Ensure meshes cast and receive shadows - REMOVED
				}
			});

			scene.add(sceneModel);
			console.log('[SceneModel] Scene model added to scene');
		} catch (err) {
			console.error('[SceneModel] Failed to load scene model from', path, ':', err);
		}
	}

	// Fetch scene configuration and react to changes
	onMount(async () => {
		try {
			console.log('[SceneModel] Fetching scene config from API...');
			const response = await fetch('/api/config');
			const config = await response.json();
			console.log('[SceneModel] Scene config received:', config);
			sceneModelPath = config.sceneModel;
			console.log('[SceneModel] Scene model path set to:', sceneModelPath);
		} catch (error) {
			console.error('[SceneModel] Failed to load scene config, using default:', error);
			sceneModelPath = '/models/street_exterior_dead_end/scene.gltf';
		}
	});

	// React to scene model path changes
	$effect(() => {
		if (sceneModelPath) {
			console.log('[SceneModel] Scene model path changed, loading:', sceneModelPath);
			loadSceneModel(sceneModelPath);
		}
	});

	// Cleanup on component unmount
	onMount(() => {
		return () => {
			if (sceneModel && scene.children.includes(sceneModel)) {
				scene.remove(sceneModel);
				console.log('[SceneModel] Scene model removed on cleanup');
			}
		};
	});
</script>

<!-- Street Lamp Light -->
<T.SpotLight
	position={[-2.6, 3, 10]}
	angle={spotLightAngle}
	penumbra={1}
	intensity={50}
	color="#ffffdd"
	distance={4000}
	decay={2}
/>

<T.PointLight position={[-2.5, 3, 8.5]} intensity={30} color="#ffffdd" distance={10} decay={2} />

<T.SpotLight
	position={[-2, 3, -4.3]}
	angle={spotLightAngle}
	penumbra={1}
	intensity={50}
	color="#ffffdd"
	distance={100}
	decay={2}
/>

<T.PointLight position={[-2.7, 3, -4.3]} intensity={30} color="#ffffdd" distance={10} decay={2} />
