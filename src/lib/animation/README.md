# VRM Animation System

This directory contains the enhanced VRM animation system that supports both traditional FBX animations (via Mixamo) and VRMA pose files.

## Components

### Core Animation System

- **`VRMALoader.ts`** - Handles loading and management of VRMA animation files
- **`PoseCatalog.ts`** - Organizes available poses by category with metadata
- **`EnhancedAnimationController.svelte.ts`** - Main controller supporting both FBX and VRMA animations
- **`AnimationController.svelte.ts`** - Original FBX-only animation controller (legacy)

### UI Components

- **`PoseSelector.svelte`** - Interactive UI for browsing and selecting poses
- **`EnhancedVRMAvatar.svelte`** - Enhanced VRM avatar component with pose support
- **`AnimationTestScene.svelte`** - Test scene for animation system development

## Features

### VRMA Pose System
- **48+ Adult Poses** organized in 8 categories:
  - Solo Female
  - Couples
  - Oral
  - Fetish
  - Handjobs
  - Teasing
  - Lesbian
  - Public
  - Advanced

### Animation Types
- **FBX Animations** - Traditional Mixamo animations for talking, idle states
- **VRMA Poses** - Static poses with optional 3D props
- **Hybrid Support** - Seamless switching between animation types

### Props System
- **3D Props** - Automatic loading of associated 3D objects (handcuffs, furniture, etc.)
- **Coordinate Positioning** - Props positioned based on coordinate reference images
- **Dynamic Loading** - Props loaded/unloaded automatically with poses

## Usage

### Basic Setup

```typescript
import { EnhancedAnimationController } from '$lib/animation/EnhancedAnimationController.svelte';
import { EnhancedVRMAvatar } from '$lib/components/EnhancedVRMAvatar.svelte';

// Use enhanced avatar with pose system
<EnhancedVRMAvatar 
    modelPath="/models/avatar.vrm"
    enablePoseSystem={true}
    bind:animationController
    bind:vrm
/>
```

### Pose Selection UI

```typescript
import PoseSelector from '$lib/components/PoseSelector.svelte';

// Show pose selector modal
<PoseSelector 
    bind:isVisible={showPoseSelector}
    bind:animationController
/>
```

### Programmatic Pose Control

```typescript
// Apply a pose directly
await animationController.applyPoseDirectly(pose);

// Return to idle animation
await animationController.returnToIdle();

// Get available poses
const poses = animationController.getAvailablePoses();
```

## Development

### Testing

Visit `/animations` route to access the test scene with:
- Model selection dropdown
- Pose selector UI
- Random pose testing
- Debug console commands

### Console Commands

Available in browser console:
- `testAnimationSystem.logStatus()` - Log current status
- `testAnimationSystem.testRandomPose()` - Apply random pose
- `testAnimationSystem.returnToIdle()` - Return to idle
- `logVRMPoseStatus()` - Detailed system status

### File Structure

```
/static/Lewd Poses [Reworked]/
├── [Category Name]/
│   ├── [Pose Name].vrma
│   ├── [Coordinate Image].PNG
│   └── [Pose Data].vpd
├── Props/
│   ├── cock3.glb
│   ├── cockv.glb
│   ├── handcuffs.glb
│   ├── park_bench.glb
│   └── phone.glb
└── Short READ ME.txt
```

## Technical Details

### VRMA Loading
- Uses `@pixiv/three-vrm-animation` for VRMA file support
- Caches loaded animations for performance
- Handles both animation clips and direct pose application

### Animation States
- `idle` - Default FBX idle animations
- `talking` - FBX talking animations with emotions
- `posing` - VRMA pose state with optional props

### Compatibility
- Works with VRM 1.0 and 0.0 avatars
- Supports Three.js AnimationMixer system
- Compatible with existing Mixamo animation workflow

## Content Warning

This system includes adult-oriented poses and animations. All content is:
- Intended for 18+ users only
- Contains realistic anatomy and mature themes
- Includes explicit pose names and descriptions
- Created by VunniBunni (credited in README)

## Limitations

1. **Pose Positioning** - Props require manual coordinate adjustment per model
2. **Model Compatibility** - Some poses may need adjustment for different VRM models
3. **Performance** - Large number of poses may impact loading times
4. **Adult Content** - Requires content filtering for general audiences

## Future Improvements

- [ ] Automatic prop positioning based on VRM bone structure
- [ ] Pose animation transitions and blending
- [ ] Custom pose creation tools
- [ ] Age-appropriate pose filtering options
- [ ] Pose thumbnail generation system