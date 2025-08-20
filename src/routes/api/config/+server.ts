import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const unsafeVrmModel = env.VRM_MODEL || 'punk.vrm';

	// Sanitize to prevent path traversal. We only expect a filename.
	const vrmModel = unsafeVrmModel.replace(/.*[\\/]/g, '');

	return json({
		vrmModel: `/models/${vrmModel}`
	});
};
