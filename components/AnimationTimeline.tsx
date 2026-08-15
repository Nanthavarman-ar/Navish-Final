import React, { useState, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface AnimationKeyframe {
  time: number;
  position?: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  scale?: BABYLON.Vector3;
  color?: BABYLON.Color3;
}

interface AnimationSequence {
  id: string;
  name: string;
  keyframes: AnimationKeyframe[];
  duration: number;
  loop: boolean;
}

interface TourKeyframe {
  time: number;
  position: BABYLON.Vector3;
}

interface TourSequence {
  id: string;
  name: string;
  keyframes: TourKeyframe[];
  duration: number;
  loop: boolean;
}

interface AnimationTimelineProps {
  animationManager: any; // AnimationManager instance
  selectedObject: BABYLON.AbstractMesh | null;
  onSequenceCreate: (sequence: AnimationSequence) => void;
  onSequencePlay: (sequenceId: string) => void;
  onClose?: () => void;
}

export const AnimationTimeline: React.FC<AnimationTimelineProps> = ({
  animationManager,
  selectedObject,
  onSequenceCreate,
  onSequencePlay,
  onClose
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(120);
  const [sequences, setSequences] = useState<AnimationSequence[]>([]);
  const [selectedSequence, setSelectedSequence] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [keyframes, setKeyframes] = useState<AnimationKeyframe[]>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [weight, setWeight] = useState(1.0);

  // Tracks whichever Quick Animation is currently running (and which preset it is), so a
  // second click can stop it instead of stacking a second animation group on top of the
  // first - two groups both driving e.g. position.y (Bounce and Wave both do) fight each
  // other every frame, which is what was reading as the object "turning into a different
  // shape". Looping presets (Bounce, Wave, Spin, Color Transition) also had no way to
  // stop them at all before this - they'd run forever once started.
  const activeQuickAnimationRef = useRef<{ group: BABYLON.AnimationGroup; type: string } | null>(null);

  // Tour mode states
  const [isTourMode, setIsTourMode] = useState(false);
  const [tourKeyframes, setTourKeyframes] = useState<TourKeyframe[]>([]);
  const [selectedTourSequence, setSelectedTourSequence] = useState<string>('');
  const [tourSequences, setTourSequences] = useState<TourSequence[]>([]);
  const [tourSpeed, setTourSpeed] = useState(1.0);

  // Add tour keyframe - auto-spaced 3s apart rather than using the shared keyframe
  // timeline's `currentTime` (that slider has nothing to do with Tour Composer, so two
  // waypoints added without deliberately dragging it first landed at the same time,
  // giving a 0-duration segment between them - playTourSequence would then jump straight
  // to the end instantly instead of visibly moving, which read as "tour doesn't work").
  const addTourKeyframe = (position: BABYLON.Vector3) => {
    setTourKeyframes(prev => [...prev, { time: prev.length * 3, position: position.clone() }].sort((a, b) => a.time - b.time));
  };

  // Remove tour keyframe
  const removeTourKeyframe = (idx: number) => {
    setTourKeyframes(prev => prev.filter((_, i) => i !== idx));
  };

  // Create tour sequence - needs at least 2 waypoints; with only 1, playTourSequence's
  // "walk between consecutive waypoints" loop has nothing to iterate over and silently
  // does nothing, which was the other way this looked broken.
  const createTourSequence = () => {
    if (tourKeyframes.length < 2) return;
    const sequence: TourSequence = {
      id: `tour_${Date.now()}`,
      name: `Tour ${tourSequences.length + 1}`,
      keyframes: tourKeyframes,
      duration: totalDuration,
      loop: false
    };
    setTourSequences(prev => [...prev, sequence]);
    setSelectedTourSequence(sequence.id);
    setTourKeyframes([]);
  };

  // Smooth camera interpolation for tour playback
  const playTourSequence = async (sequenceId: string) => {
    const sequence = tourSequences.find(s => s.id === sequenceId);
    if (!sequence || !selectedObject || sequence.keyframes.length < 2) return;
    setIsPlaying(true);
    for (let i = 0; i < sequence.keyframes.length - 1; i++) {
      const start = sequence.keyframes[i].position;
      const end = sequence.keyframes[i + 1].position;
      const duration = Math.max((sequence.keyframes[i + 1].time - sequence.keyframes[i].time) / tourSpeed, 0.3);
      let t = 0;
      while (t < 1) {
        const interp = BABYLON.Vector3.Lerp(start, end, t);
        selectedObject.position.copyFrom(interp);
        t += 0.02;
        await new Promise(res => setTimeout(res, duration * 20));
      }
      selectedObject.position.copyFrom(end);
    }
    setIsPlaying(false);
  };

  // Export tour sequence to JSON
  const exportTourSequence = (sequenceId: string) => {
    const sequence = tourSequences.find(s => s.id === sequenceId);
    if (!sequence) return;
    const dataStr = JSON.stringify(sequence, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sequence.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import tour sequence from JSON
  const importTourSequence = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data && data.keyframes) {
          setTourSequences(prev => [...prev, data]);
        }
      } catch {
        // ignore malformed tour sequence file
      }
    };
    reader.readAsText(file);
  };

  const animationTypes = [
    { value: 'bounce', label: 'Bounce' },
    { value: 'fade', label: 'Fade' },
    { value: 'scale', label: 'Scale' },
    { value: 'color', label: 'Color Transition' },
    { value: 'wave', label: 'Wave' },
    { value: 'spring', label: 'Spring' },
    { value: 'rotation', label: 'Rotation' }
  ];

  const addKeyframe = () => {
    if (!selectedObject) return;

    const newKeyframe: AnimationKeyframe = {
      time: currentTime,
      position: selectedObject.position.clone(),
      rotation: selectedObject.rotation.clone(),
      scale: selectedObject.scaling.clone()
    };

    setKeyframes(prev => [...prev, newKeyframe].sort((a, b) => a.time - b.time));
  };

  const createSequence = () => {
    if (keyframes.length === 0 || !animationManager || !selectedObject) return;

    // Previously this only stored the recorded keyframes in local component
    // state - it never became a real Babylon animation, so selecting it and
    // hitting Play called animationManager.playAnimation() on an id the
    // manager had never heard of, and nothing happened.
    const sequenceId = `seq_${Date.now()}`;
    const sequenceName = `Sequence ${sequences.length + 1}`;
    const fps = 30;
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    const babylonAnimations: BABYLON.Animation[] = [];

    const buildTrack = (property: 'position' | 'rotation' | 'scale', targetProperty: string) => {
      const keys = sorted.filter(k => k[property]).map(k => ({ frame: k.time * fps, value: k[property]! }));
      if (keys.length < 2) return;
      const anim = new BABYLON.Animation(
        `${sequenceId}_${property}`, targetProperty, fps,
        BABYLON.Animation.ANIMATIONTYPE_VECTOR3, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
      );
      anim.setKeys(keys);
      babylonAnimations.push(anim);
    };
    buildTrack('position', 'position');
    // Babylon renders a mesh's orientation from rotationQuaternion whenever it's set,
    // and completely ignores the Euler `rotation` property in that case - animating
    // `rotation` unconditionally (as this used to do) was a silent no-op for any mesh
    // using rotationQuaternion, which is the default for imported GLTF/BIM models (most
    // of what's actually loaded here). Animate rotationQuaternion instead when present.
    if (selectedObject.rotationQuaternion) {
      const rotKeys = sorted.filter(k => k.rotation).map(k => ({
        frame: k.time * fps,
        value: BABYLON.Quaternion.FromEulerVector(k.rotation!)
      }));
      if (rotKeys.length >= 2) {
        const rotAnim = new BABYLON.Animation(
          `${sequenceId}_rotationQuaternion`, 'rotationQuaternion', fps,
          BABYLON.Animation.ANIMATIONTYPE_QUATERNION, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
        );
        rotAnim.setKeys(rotKeys);
        babylonAnimations.push(rotAnim);
      }
    } else {
      buildTrack('rotation', 'rotation');
    }
    buildTrack('scale', 'scaling');

    if (babylonAnimations.length === 0) return;

    animationManager.registerAnimationGroup({
      id: sequenceId,
      name: sequenceName,
      animations: babylonAnimations,
      targetMeshes: [selectedObject],
      speedRatio: 1.0,
      weight: 1.0,
      isLooping: false
    });

    const sequence: AnimationSequence = {
      id: sequenceId,
      name: sequenceName,
      keyframes: keyframes,
      duration: totalDuration,
      loop: false
    };

    setSequences(prev => [...prev, sequence]);
    setSelectedSequence(sequence.id);
    setKeyframes([]);
    onSequenceCreate(sequence);
  };

  const quickAnimation = (type: string) => {
    if (!selectedObject || !animationManager) return;

    let presetName: string | undefined;

    // These previously pointed at preset names ('fade', 'scale', 'rotation') that were
    // never actually registered in AnimationManager - createAnimationFromPreset just
    // logged a console warning and returned null, so those buttons silently did
    // nothing. Pointing at the presets that actually exist (and adding real 'wave'/
    // 'spring' ones, which didn't exist at all before).
    switch (type) {
      case 'bounce':
        presetName = 'bounce';
        break;
      case 'fade':
        presetName = 'fadein';
        break;
      case 'scale':
        presetName = 'scalein';
        break;
      case 'color':
        presetName = 'colorcycle';
        break;
      case 'wave':
        presetName = 'wave';
        break;
      case 'spring':
        presetName = 'spring';
        break;
      case 'rotation':
        presetName = 'spin';
        break;
    }

    if (!presetName) return;

    // Always clear out whatever quick animation was previously running on this object
    // first - stops it, and returns its properties (position/rotation/scale/visibility)
    // to wherever they were, so the new one starts from a clean state instead of
    // stacking on top of a still-running one.
    if (activeQuickAnimationRef.current) {
      const wasSameType = activeQuickAnimationRef.current.type === type;
      activeQuickAnimationRef.current.group.stop();
      activeQuickAnimationRef.current.group.dispose();
      activeQuickAnimationRef.current = null;
      // Clicking the same button again while it's playing acts as a stop/toggle-off,
      // matching how you'd expect a looping preset (Bounce, Wave, Spin, Color
      // Transition all loop forever) to be turned off - there was previously no way to.
      if (wasSameType) return;
    }

    // createAnimationFromPreset already returns a real, fully-built BABYLON.AnimationGroup
    // with the animation targeted at selectedObject - this used to be thrown away and
    // replaced with a call to registerAnimationGroup({ animations: [], ... }), which
    // builds a brand new, completely EMPTY animation group (registerAnimationGroup adds
    // one targeted animation per entry in the `animations` array it's given, and that
    // array was empty). playAnimation() was then playing that empty group, which is
    // indistinguishable from doing nothing - the buttons never actually animated anything.
    const animationGroup = animationManager.createAnimationFromPreset(presetName, selectedObject);
    if (animationGroup) {
      animationGroup.play(animationGroup.loopAnimation);
      activeQuickAnimationRef.current = { group: animationGroup, type };
      // Non-looping presets (Fade In, Scale In, Spring) finish on their own - clear the
      // ref once that happens so a later click of a *different* button doesn't try to
      // stop/dispose an animation group that already disposed itself.
      if (!animationGroup.loopAnimation) {
        animationGroup.onAnimationGroupEndObservable.addOnce(() => {
          if (activeQuickAnimationRef.current?.group === animationGroup) {
            activeQuickAnimationRef.current = null;
          }
        });
      }
    } else {
      console.warn(`Quick animation '${type}' (preset '${presetName}') failed to build`);
    }
  };

  // Stop and dispose any still-running quick animation when the panel unmounts or the
  // selected object changes, so switching objects doesn't leave a stray animation
  // running against whatever mesh happened to be selected before.
  useEffect(() => {
    return () => {
      if (activeQuickAnimationRef.current) {
        activeQuickAnimationRef.current.group.stop();
        activeQuickAnimationRef.current.group.dispose();
        activeQuickAnimationRef.current = null;
      }
    };
  }, [selectedObject]);

  const playSequence = (sequenceId: string) => {
    if (animationManager && sequenceId) {
      animationManager.playAnimation(sequenceId);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3">
        <CardTitle className="text-base">Animation Timeline</CardTitle>
        {onClose && (
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={onClose} aria-label="Close Animation Timeline">✕</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Every control below silently no-ops without these two - previously there was
            no indication why, so a disabled/inert button just looked broken. */}
        {!animationManager && (
          <p className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
            Animation system isn't ready yet - try reopening this panel in a moment.
          </p>
        )}
        {animationManager && !selectedObject && (
          <p className="text-xs text-muted-foreground bg-muted/50 border rounded px-2 py-1.5">
            Select an object in the scene to enable these controls.
          </p>
        )}
        {/* Timeline Controls */}
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => {
              // Previously only toggled local UI state - the actual scene
              // animation never started or stopped, so every click looked
              // like it did nothing.
              if (animationManager && selectedSequence) {
                if (isPlaying) {
                  animationManager.pauseAnimation(selectedSequence);
                } else {
                  animationManager.playAnimation(selectedSequence);
                }
              }
              setIsPlaying(!isPlaying);
            }}
            variant={isPlaying ? "destructive" : "default"}
            disabled={!selectedSequence}
            title={!selectedSequence ? 'Select or create a sequence first' : undefined}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          <Button
            onClick={() => {
              setCurrentTime(0);
              setIsPlaying(false);
              if (animationManager && selectedSequence) {
                animationManager.scrubToTime(selectedSequence, 0);
              }
            }}
            variant="outline"
          >
            Reset
          </Button>

          <Button
            onClick={() => {
              setPreviewMode(!previewMode);
              if (animationManager) {
                animationManager.enableRealtimePreview(!previewMode);
              }
            }}
            variant={previewMode ? "default" : "outline"}
            size="sm"
          >
            {previewMode ? 'Preview ON' : 'Preview OFF'}
          </Button>

          <div className="flex-1">
            <Slider
              value={[currentTime]}
              onValueChange={(value) => {
                setCurrentTime(value[0]);
                if (animationManager && previewMode) {
                  // Scrub to time in real-time
                  animationManager.scrubToTime(selectedSequence, value[0]);
                }
              }}
              max={totalDuration}
              step={1}
              className="w-full"
            />
          </div>

          <span className="text-sm font-mono">
            {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')}
          </span>
        </div>

        {/* Real-time Parameter Controls */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Speed: {speed.toFixed(1)}x</label>
            <Slider
              value={[speed]}
              onValueChange={(value) => {
                setSpeed(value[0]);
                if (animationManager && selectedSequence) {
                  animationManager.updateAnimationSpeed(selectedSequence, value[0]);
                }
              }}
              min={0.1}
              max={3.0}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Weight: {weight.toFixed(1)}</label>
            <Slider
              value={[weight]}
              onValueChange={(value) => {
                setWeight(value[0]);
                if (animationManager && selectedSequence) {
                  animationManager.updateAnimationWeight(selectedSequence, value[0]);
                }
              }}
              min={0.0}
              max={1.0}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Duration: {totalDuration}s</label>
            <Slider
              value={[totalDuration]}
              onValueChange={(value) => {
                setTotalDuration(value[0]);
                if (animationManager && selectedSequence) {
                  animationManager.updateAnimationDuration(selectedSequence, value[0]);
                }
              }}
              min={10}
              max={300}
              step={5}
              className="w-full"
            />
          </div>
        </div>

        {/* Quick Animations */}
        <div className="grid grid-cols-4 gap-2">
          {animationTypes.map(type => (
            <Button
              key={type.value}
              onClick={() => quickAnimation(type.value)}
              variant="outline"
              size="sm"
              disabled={!selectedObject || !animationManager}
              title={!animationManager ? "Animation system isn't ready yet" : !selectedObject ? 'Select an object first' : undefined}
            >
              {type.label}
            </Button>
          ))}
        </div>

        {/* Keyframe Controls */}
        <p className="text-xs text-muted-foreground">
          Move the time slider above, pose the object (move/rotate/scale it), then Add Keyframe. Repeat at a different time with a different pose before Create Sequence - two identical poses won't visibly animate.
        </p>
        <div className="flex items-center space-x-2">
          <Button
            onClick={addKeyframe}
            disabled={!selectedObject}
            variant="outline"
            title={!selectedObject ? 'Select an object first' : undefined}
          >
            Add Keyframe
          </Button>
          <Button
            onClick={createSequence}
            disabled={keyframes.length === 0 || !animationManager}
            variant="default"
            title={keyframes.length === 0 ? 'Add at least one keyframe first' : !animationManager ? "Animation system isn't ready yet" : undefined}
          >
            Create Sequence
          </Button>
        </div>

        {/* Keyframes Display */}
        <div className="border rounded p-2 min-h-[100px]">
          <h4 className="text-sm font-semibold mb-2">Keyframes:</h4>
          <div className="flex flex-wrap gap-1">
            {keyframes.length === 0 && (
              <p className="text-xs text-muted-foreground">No keyframes yet - select an object and click "Add Keyframe".</p>
            )}
            {keyframes.map((kf, index) => (
              <div key={index} className="flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs">
                {kf.time}s
                <button
                  type="button"
                  onClick={() => setKeyframes(prev => prev.filter((_, i) => i !== index))}
                  className="text-blue-900/60 hover:text-blue-900 font-bold leading-none"
                  aria-label={`Remove keyframe at ${kf.time}s`}
                  title="Remove keyframe"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sequences */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Sequences:</h4>
          {sequences.map(sequence => (
            <div key={sequence.id} className="flex items-center space-x-2">
              <Button
                onClick={() => setSelectedSequence(sequence.id)}
                variant={selectedSequence === sequence.id ? "default" : "outline"}
                size="sm"
                className="flex-1"
              >
                {sequence.name}
              </Button>
              <Button
                onClick={() => playSequence(sequence.id)}
                size="sm"
                variant="outline"
              >
                Play
              </Button>
            </div>
          ))}
        </div>

        {/* Tour Mode Controls - a lightweight bordered section rather than a full nested
            Card, which was stacking its own padding/border on top of the outer Card and
            was a large part of why this panel felt like it took over the screen. */}
        <div className="border rounded p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Tour Composer</span>
            <Button size="sm" variant={isTourMode ? 'default' : 'outline'} onClick={() => setIsTourMode(!isTourMode)}>{isTourMode ? 'Exit Tour Mode' : 'Enter Tour Mode'}</Button>
          </div>
          {isTourMode && (
              <div className="space-y-2 mt-2">
                <p className="text-xs text-muted-foreground">
                  Move the object to a spot, click Add Waypoint, move it to the next spot, click Add Waypoint again - repeat for the whole path, then Create Tour Sequence.
                </p>
                <div className="flex gap-2 mb-2">
                  <Button size="sm" onClick={() => addTourKeyframe(selectedObject?.position || BABYLON.Vector3.Zero())}>Add Waypoint</Button>
                  <Button
                    size="sm"
                    onClick={createTourSequence}
                    disabled={tourKeyframes.length < 2}
                    title={tourKeyframes.length < 2 ? 'Add at least 2 waypoints first' : undefined}
                  >
                    Create Tour Sequence
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setTourKeyframes([])}>Clear Keyframes</Button>
                </div>
                <div className="flex gap-2 items-center mb-2">
                  <label className="text-xs">Speed:</label>
                  <Slider min={0.5} max={3} step={0.1} value={[tourSpeed]} onValueChange={arr => setTourSpeed(arr[0])} />
                  <span className="text-xs">{tourSpeed}x</span>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium">Keyframes</div>
                  <ul className="text-xs">
                    {tourKeyframes.map((kf, idx) => (
                      <li key={idx} className="flex gap-2 items-center">
                        <span>t={kf.time}s ({kf.position.x.toFixed(1)}, {kf.position.y.toFixed(1)}, {kf.position.z.toFixed(1)})</span>
                        <Button size="sm" variant="outline" onClick={() => removeTourKeyframe(idx)}>Remove</Button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium">Tour Sequences</div>
                  <ul className="text-xs">
                    {tourSequences.map(seq => (
                      <li key={seq.id} className="flex gap-2 items-center">
                        <span>{seq.name}</span>
                        <Button size="sm" variant="default" onClick={() => playTourSequence(seq.id)}>Play</Button>
                        <Button size="sm" variant="outline" onClick={() => exportTourSequence(seq.id)}>Export</Button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2 mt-2">
                    <label htmlFor="import-tour-file" className="sr-only">Import Tour</label>
                    <input id="import-tour-file" type="file" accept=".json" onChange={e => {
                      if (e.target.files && e.target.files[0]) importTourSequence(e.target.files[0]);
                    }} />
                    <span className="text-xs">Import Tour</span>
                  </div>
                </div>
              </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
