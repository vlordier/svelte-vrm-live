import type { VRMAPose } from './VRMALoader';

/**
 * Pose catalog containing all available VRMA poses organized by category
 * Generated from the "Lewd Poses [Reworked]" directory structure
 */
export class PoseCatalog {
	private static readonly BASE_PATH = '/Lewd Poses [Reworked]';

	/**
	 * All available poses organized by category
	 */
	static readonly poses: Record<string, VRMAPose[]> = {
		'Solo Female': [
			{
				name: 'Better Cuffed Female',
				path: `${this.BASE_PATH}/Better Cuffed/Better Cuffed Female Pose.vrma`,
				category: 'Solo Female',
				description: 'Female pose with handcuffs',
				props: ['handcuffs.glb'],
				coordinateImages: ['Better Cuffed Handcuff Coordinates.PNG']
			},
			{
				name: 'Female Masturbation',
				path: `${this.BASE_PATH}/Female Masturbation/Female Masturbation Pose.vrma`,
				category: 'Solo Female',
				description: 'Solo female masturbation pose'
			},
			{
				name: 'Feet Focus',
				path: `${this.BASE_PATH}/Feet Focus/Feet Focus Pose.vrma`,
				category: 'Solo Female',
				description: 'Female pose focusing on feet'
			},
			{
				name: 'Spread Legs',
				path: `${this.BASE_PATH}/Spread Legs/Spread Legs Pose.vrma`,
				category: 'Solo Female',
				description: 'Female pose with spread legs'
			}
		],
		
		'Couples': [
			{
				name: 'Anal Doggystyle Female',
				path: `${this.BASE_PATH}/Anal Doggystyle/Anal Doggystyle Female Pose.vrma`,
				category: 'Couples',
				description: 'Female pose for anal doggystyle position',
				props: ['cockv.glb'],
				coordinateImages: ['Anal Doggystyle Penis Coordinates.PNG']
			},
			{
				name: 'Anal Doggystyle Male',
				path: `${this.BASE_PATH}/Anal Doggystyle/Anal Doggystyle Male Pose.vrma`,
				category: 'Couples',
				description: 'Male pose for anal doggystyle position',
				props: ['cockv.glb'],
				coordinateImages: ['Anal Doggystyle Penis Coordinates.PNG']
			},
			{
				name: 'Choking Female',
				path: `${this.BASE_PATH}/Choking/Choking Female Pose.vrma`,
				category: 'Couples',
				description: 'Female pose for choking scenario'
			},
			{
				name: 'Choking Male',
				path: `${this.BASE_PATH}/Choking/Choking Male Pose.vrma`,
				category: 'Couples',
				description: 'Male pose for choking scenario'
			},
			{
				name: 'Missionary Female',
				path: `${this.BASE_PATH}/Missionary/Missionary Pose 1.vrma`,
				category: 'Couples',
				description: 'Female missionary position',
				props: ['cockv.glb'],
				coordinateImages: ['Missionary Penis Coordinates.PNG']
			},
			{
				name: 'Missionary Male',
				path: `${this.BASE_PATH}/Missionary/Missionary Pose 2.vrma`,
				category: 'Couples',
				description: 'Male missionary position',
				props: ['cockv.glb'],
				coordinateImages: ['Missionary Penis Coordinates.PNG']
			},
			{
				name: 'Riding Female',
				path: `${this.BASE_PATH}/Riding Cock/Riding Cock Pose 1.vrma`,
				category: 'Couples',
				description: 'Female riding position',
				props: ['cock3.glb'],
				coordinateImages: ['Riding Cock Penis Coordinates.PNG']
			},
			{
				name: 'Riding Male',
				path: `${this.BASE_PATH}/Riding Cock/Riding Cock Pose 2.vrma`,
				category: 'Couples',
				description: 'Male riding position (bottom)',
				props: ['cock3.glb'],
				coordinateImages: ['Riding Cock Penis Coordinates.PNG']
			}
		],

		'Oral': [
			{
				name: 'Sitting Blowjob Female',
				path: `${this.BASE_PATH}/Sitting Blowjob/Sitting Blowjob Pose 1.vrma`,
				category: 'Oral',
				description: 'Female sitting blowjob pose'
			},
			{
				name: 'Sitting Blowjob Male',
				path: `${this.BASE_PATH}/Sitting Blowjob/Sitting Blowjob Pose 2.vrma`,
				category: 'Oral',
				description: 'Male sitting blowjob pose'
			},
			{
				name: 'Penis Kiss Female',
				path: `${this.BASE_PATH}/Penis Kiss/Penis Kiss Pose 1.vrma`,
				category: 'Oral',
				description: 'Female kissing penis pose',
				props: ['cockv.glb'],
				coordinateImages: ['Penis Kiss Penis Coordinates.PNG']
			},
			{
				name: 'Penis Kiss Male',
				path: `${this.BASE_PATH}/Penis Kiss/Penis Kiss Pose 2.vrma`,
				category: 'Oral',
				description: 'Male receiving kiss pose',
				props: ['cockv.glb'],
				coordinateImages: ['Penis Kiss Penis Coordinates.PNG']
			}
		],

		'Fetish': [
			{
				name: 'Back Footjob Female',
				path: `${this.BASE_PATH}/Back Footjob/Back Footjob Female Pose.vrma`,
				category: 'Fetish',
				description: 'Female back footjob pose',
				props: ['cockv.glb'],
				coordinateImages: ['Back Footjob Penis Coordinates.PNG']
			},
			{
				name: 'Back Footjob Male',
				path: `${this.BASE_PATH}/Back Footjob/Back Footjob Male Pose.vrma`,
				category: 'Fetish',
				description: 'Male back footjob pose',
				props: ['cockv.glb'],
				coordinateImages: ['Back Footjob Penis Coordinates.PNG']
			},
			{
				name: 'Better Footjob',
				path: `${this.BASE_PATH}/Better Footjob/Better Footjob Pose.vrma`,
				category: 'Fetish',
				description: 'Improved footjob pose',
				props: ['cockv.glb'],
				coordinateImages: ['Better Footjob Penis Coordinates.PNG']
			},
			{
				name: 'Double Footjob Pose 1',
				path: `${this.BASE_PATH}/Double Footjob/Double Footjob Pose 1.vrma`,
				category: 'Fetish',
				description: 'First person in double footjob',
				props: ['cockv.glb'],
				coordinateImages: ['Double Footjob Penis Coordinates.PNG']
			},
			{
				name: 'Double Footjob Pose 2',
				path: `${this.BASE_PATH}/Double Footjob/Double Footjob Pose 2.vrma`,
				category: 'Fetish',
				description: 'Second person in double footjob',
				props: ['cockv.glb'],
				coordinateImages: ['Double Footjob Penis Coordinates.PNG']
			}
		],

		'Handjobs': [
			{
				name: 'Nursing Handjob Female',
				path: `${this.BASE_PATH}/Nursing HandJob/Nursing Handjob Pose 1.vrma`,
				category: 'Handjobs',
				description: 'Female nursing handjob pose',
				props: ['cockv.glb'],
				coordinateImages: ['Nursing Handjob Penis Coordinates.PNG']
			},
			{
				name: 'Nursing Handjob Male',
				path: `${this.BASE_PATH}/Nursing HandJob/Nursing Handjob Pose 2.vrma`,
				category: 'Handjobs',
				description: 'Male nursing handjob pose',
				props: ['cockv.glb'],
				coordinateImages: ['Nursing Handjob Penis Coordinates.PNG']
			},
			{
				name: 'Staring at Cock Female',
				path: `${this.BASE_PATH}/Staring at Cock/Staring at Cock Pose 1.vrma`,
				category: 'Handjobs',
				description: 'Female staring at cock pose',
				props: ['cockv.glb'],
				coordinateImages: ['Staring at Cock Penis Coordinates.PNG']
			},
			{
				name: 'Staring at Cock Male',
				path: `${this.BASE_PATH}/Staring at Cock/Staring at Cock Pose 2.vrma`,
				category: 'Handjobs',
				description: 'Male staring at cock pose',
				props: ['cockv.glb'],
				coordinateImages: ['Staring at Cock Penis Coordinates.PNG']
			}
		],

		'Teasing': [
			{
				name: 'Cock Teasing',
				path: `${this.BASE_PATH}/Cock Teasing/Cock Teasing.vpd`, // Note: VPD file, may need conversion
				category: 'Teasing',
				description: 'Cock teasing pose with phone prop',
				props: ['phone.glb'],
				coordinateImages: ['Cock Teasing Penis Coordinates.PNG', 'Cock Teasing Phone Coordinates.PNG']
			}
		],

		'Lesbian': [
			{
				name: 'Scissoring Pose 1',
				path: `${this.BASE_PATH}/Scissoring/Scissoring Pose 1.vrma`,
				category: 'Lesbian',
				description: 'First person in scissoring position'
			},
			{
				name: 'Scissoring Pose 2',
				path: `${this.BASE_PATH}/Scissoring/Scissoring Pose 2.vrma`,
				category: 'Lesbian',
				description: 'Second person in scissoring position'
			}
		],

		'Public': [
			{
				name: 'In the Park Female',
				path: `${this.BASE_PATH}/In the Park/In the Park Pose 1.vrma`,
				category: 'Public',
				description: 'Female pose in park setting',
				props: ['park_bench.glb', 'cockv.glb'],
				coordinateImages: ['In the Park Penis Coordinates.PNG']
			},
			{
				name: 'In the Park Male',
				path: `${this.BASE_PATH}/In the Park/In the Park Pose 2.vrma`,
				category: 'Public',
				description: 'Male pose in park setting',
				props: ['park_bench.glb', 'cockv.glb'],
				coordinateImages: ['In the Park Penis Coordinates.PNG']
			}
		],

		'Advanced': [
			{
				name: 'Full Nelson Female',
				path: `${this.BASE_PATH}/Full Nelson/Full Nelson Pose 1.vrma`,
				category: 'Advanced',
				description: 'Female full nelson position',
				props: ['cockv.glb'],
				coordinateImages: ['Full Nelson Penis Coordinates.PNG', 'Full Nelson Penis Coordinates 2.PNG']
			},
			{
				name: 'Full Nelson Male',
				path: `${this.BASE_PATH}/Full Nelson/Full Nelson Pose 2.vrma`,
				category: 'Advanced',
				description: 'Male full nelson position',
				props: ['cockv.glb'],
				coordinateImages: ['Full Nelson Penis Coordinates.PNG', 'Full Nelson Penis Coordinates 2.PNG']
			},
			{
				name: 'Lotus Female',
				path: `${this.BASE_PATH}/Lotus/Lotus Pose 1.vrma`,
				category: 'Advanced',
				description: 'Female lotus position',
				props: ['cockv.glb'],
				coordinateImages: ['Lotus Penis Coordinates.PNG']
			},
			{
				name: 'Lotus Male',
				path: `${this.BASE_PATH}/Lotus/Lotus Pose 2.vrma`,
				category: 'Advanced',
				description: 'Male lotus position',
				props: ['cockv.glb'],
				coordinateImages: ['Lotus Penis Coordinates.PNG']
			}
		]
	};

	/**
	 * Available props/accessories
	 */
	static readonly props = {
		'cock3.glb': `${this.BASE_PATH}/Props/cock3.glb`,
		'cockv.glb': `${this.BASE_PATH}/Props/cockv.glb`,
		'handcuffs.glb': `${this.BASE_PATH}/Props/handcuffs.glb`,
		'park_bench.glb': `${this.BASE_PATH}/Props/park_bench.glb`,
		'phone.glb': `${this.BASE_PATH}/Props/phone.glb`
	};

	/**
	 * Get all poses flattened into a single array
	 */
	static getAllPoses(): VRMAPose[] {
		return Object.values(this.poses).flat();
	}

	/**
	 * Get poses by category
	 */
	static getPosesByCategory(category: string): VRMAPose[] {
		return this.poses[category] || [];
	}

	/**
	 * Get all categories
	 */
	static getCategories(): string[] {
		return Object.keys(this.poses);
	}

	/**
	 * Search poses by name or description
	 */
	static searchPoses(query: string): VRMAPose[] {
		const lowercaseQuery = query.toLowerCase();
		return this.getAllPoses().filter(pose => 
			pose.name.toLowerCase().includes(lowercaseQuery) ||
			(pose.description && pose.description.toLowerCase().includes(lowercaseQuery))
		);
	}

	/**
	 * Get pose by exact name
	 */
	static getPoseByName(name: string): VRMAPose | null {
		return this.getAllPoses().find(pose => pose.name === name) || null;
	}

	/**
	 * Get prop path by name
	 */
	static getPropPath(propName: string): string | null {
		return this.props[propName as keyof typeof this.props] || null;
	}
}