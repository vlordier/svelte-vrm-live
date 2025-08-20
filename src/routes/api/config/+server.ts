import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { basename } from 'path';

export const GET: RequestHandler = async () => {
	const unsafeVrmModel = env.VRM_MODEL || 'punk.vrm';

	// Use path.basename for robust path traversal protection
	const baseFilename = basename(unsafeVrmModel);

	// Explicitly check for directory traversal patterns
	if (baseFilename === '.' || baseFilename === '..' || baseFilename.length === 0) {
		// Fallback to default model if suspicious input detected
		const vrmModel = 'punk.vrm';
		return json({
			vrmModel: `/models/${vrmModel}`
		});
	}

	return json({
		vrmModel: `/models/${baseFilename}`
	});
};
