import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	const defaultModel = 'punk.vrm';
	const unsafeVrmModel = env.VRM_MODEL || defaultModel;

	// Use platform-agnostic string manipulation for portability instead of Node's `path` module
	// Split on both forward and back slashes and get the last part (filename)
	let baseFilename = unsafeVrmModel.split(/[\\/]/).pop() || '';

	// Explicitly check for directory traversal patterns and invalid names
	if (baseFilename === '.' || baseFilename === '..' || baseFilename.length === 0) {
		// Fallback to default model if suspicious input detected
		baseFilename = defaultModel;
	}

	return json({
		vrmModel: `/models/${baseFilename}`
	});
};
