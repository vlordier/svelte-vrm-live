import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const vrmModel = env.VRM_MODEL || 'punk.vrm';

	return json({
		vrmModel: `/models/${vrmModel}`
	});
};
