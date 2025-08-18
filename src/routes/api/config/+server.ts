import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const vrmModel = env.VRM_MODEL || 'punk.vrm';
	const sceneModel = env.SCENE_MODEL || 'street_exterior_dead_end';

	// Determine the correct scene file path based on the model
	let sceneModelPath: string;
	if (sceneModel === 'bedroom') {
		sceneModelPath = '/models/bedroom/bedroom.glb';
	} else if (sceneModel === 'street_exterior_dead_end') {
		sceneModelPath = '/models/street_exterior_dead_end/scene.gltf';
	} else {
		// Default fallback or custom path
		sceneModelPath = `/models/${sceneModel}/scene.gltf`;
	}

	return json({
		vrmModel: `/models/${vrmModel}`,
		sceneModel: sceneModelPath
	});
};
