const MEDIAPIPE_VERSION = '0.10.35';
const MEDIAPIPE_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const MEDIAPIPE_WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const MIN_HAND_CONFIDENCE = 0.4;
const MIN_POSE_CONFIDENCE = 0.4;

const HandTracking = {
  _hands: null,
  _pose: null,

  async init() {
    if (this._hands) return;
    const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import(MEDIAPIPE_BUNDLE_URL);
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);

    const create = async (Task, modelUrl, extra) => {
      for (const delegate of ['GPU', 'CPU']) {
        try {
          return await Task.createFromOptions(vision, {
            baseOptions: { modelAssetPath: modelUrl, delegate },
            runningMode: 'video',
            ...extra
          });
        } catch (err) {
          if (delegate === 'CPU') throw err;
          console.warn(`[HandTracking] GPU indisponível, usando CPU:`, err);
        }
      }
    };

    this._hands = await create(HandLandmarker, HAND_LANDMARKER_MODEL_URL, {
      numHands: 2,
      minHandDetectionConfidence: MIN_HAND_CONFIDENCE,
      minHandPresenceConfidence: MIN_HAND_CONFIDENCE,
      minTrackingConfidence: MIN_HAND_CONFIDENCE
    });
    this._pose = await create(PoseLandmarker, POSE_LANDMARKER_MODEL_URL, {
      numPoses: 1,
      minPoseDetectionConfidence: MIN_POSE_CONFIDENCE,
      minPosePresenceConfidence: MIN_POSE_CONFIDENCE,
      minTrackingConfidence: MIN_POSE_CONFIDENCE
    });
  },

  detect(videoEl, timestampMs) {
    if (!this._hands) return { hands: { left: null, right: null }, pose: null };

    const handResult = this._hands.detectForVideo(videoEl, timestampMs);
    const hands = { left: null, right: null };
    const found = handResult.landmarks || [];
    const labelOf = i => {
      const l = handResult.handednesses?.[i]?.[0]?.categoryName?.toLowerCase();
      return l === 'left' || l === 'right' ? l : null;
    };
    const order = found.map((_, i) => i);
    if (found.length === 2 && labelOf(0) && labelOf(0) === labelOf(1)) {
      order.sort((a, b) => found[a][0].x - found[b][0].x);
      hands.right = found[order[0]];
      hands.left = found[order[1]];
    } else {
      order.forEach(i => {
        const label = labelOf(i) || (hands.right ? 'left' : 'right');
        const slot = hands[label] ? (label === 'left' ? 'right' : 'left') : label;
        if (!hands[slot]) hands[slot] = found[i];
      });
    }

    const poseResult = this._pose?.detectForVideo(videoEl, timestampMs);
    const pose = poseResult?.landmarks?.[0] ?? null;

    return { hands, pose };
  }
};
