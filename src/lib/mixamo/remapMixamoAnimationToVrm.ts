import * as THREE from 'three';
import { mixamoVRMRigMap } from './vrmRigMap';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

export function remapMixamoAnimationToVrm(vrm: VRM, asset: THREE.Group) {
	const clip = THREE.AnimationClip.findByName(asset.animations, 'mixamo.com').clone(); // extract the AnimationClip

	const tracks: THREE.KeyframeTrack[] = []; // KeyframeTracks compatible with VRM will be added here

	const restRotationInverse = new THREE.Quaternion();
	const parentRestWorldRotation = new THREE.Quaternion();
	const _quatA = new THREE.Quaternion();
	const _vec3 = new THREE.Vector3();

	// Adjust with reference to hips height.
	const hipsObject = asset.getObjectByName('mixamorigHips');
	if (!hipsObject) throw new Error('mixamorigHips not found in asset');
	const motionHipsHeight = hipsObject.position.y;
	const vrmHipsNode = vrm.humanoid?.getNormalizedBoneNode('hips');
	if (!vrmHipsNode) throw new Error('VRM hips bone not found');
	const vrmHipsY = vrmHipsNode.getWorldPosition(_vec3).y;
	const vrmRootY = vrm.scene.getWorldPosition(_vec3).y;
	const vrmHipsHeight = Math.abs(vrmHipsY - vrmRootY);
	const hipsPositionScale = vrmHipsHeight / motionHipsHeight;

	clip.tracks.forEach((track) => {
		// Convert each tracks for VRM use, and push to `tracks`
		const trackSplitted = track.name.split('.');
		const mixamoRigName = trackSplitted[0];
		const vrmBoneName = mixamoVRMRigMap[mixamoRigName as keyof typeof mixamoVRMRigMap];
		const vrmNode = vrm.humanoid?.getNormalizedBoneNode(vrmBoneName as VRMHumanBoneName);
		const vrmNodeName = vrmNode?.name;
		const mixamoRigNode = asset.getObjectByName(mixamoRigName);

		if (vrmNodeName != null && mixamoRigNode) {
			const propertyName = trackSplitted[1];

			// Store rotations of rest-pose.
			mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
			if (mixamoRigNode.parent) {
				mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);
			}

			if (track instanceof THREE.QuaternionKeyframeTrack) {
				// Retarget rotation of mixamoRig to NormalizedBone.
				for (let i = 0; i < track.values.length; i += 4) {
					const flatQuaternion = track.values.slice(i, i + 4);

					_quatA.fromArray(Array.from(flatQuaternion) as [number, number, number, number]);

					// 親のレスト時ワールド回転 * トラックの回転 * レスト時ワールド回転の逆
					_quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);

					_quatA.toArray(flatQuaternion);

					flatQuaternion.forEach((v, index) => {
						track.values[index + i] = v;
					});
				}

				tracks.push(
					new THREE.QuaternionKeyframeTrack(
						`${vrmNodeName}.${propertyName}`,
						track.times,
						track.values.map((v, i) => (vrm.meta?.metaVersion === '0' && i % 2 === 0 ? -v : v))
					)
				);
			} else if (track instanceof THREE.VectorKeyframeTrack) {
				const value = track.values.map(
					(v, i) => (vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? -v : v) * hipsPositionScale
				);
				tracks.push(
					new THREE.VectorKeyframeTrack(`${vrmNodeName}.${propertyName}`, track.times, value)
				);
			}
		}
	});

	return new THREE.AnimationClip('vrmAnimation', clip.duration, tracks);
}
