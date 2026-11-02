/**
 * What the webcam can honestly say about a trainee: whether they were facing
 * the patient. Head direction only, because it is a big movement the model reads
 * well. Eye direction, nods and expressions are left out as too unreliable to
 * tell a trainee about.
 *
 * Deliberately no "interest", "boredom" or "engagement" anywhere in here. Those
 * would be claims about what someone feels, which a face does not reliably
 * show -- and inferring them in a training setting is what the EU AI Act bans
 * (Art. 5(1)(f)). Everything below is a behaviour a human assessor could also
 * point at. Keep it that way when adding a metric.
 */

export type VisiblePresenceSample = {
  /** Seconds since tracking started. */
  time: number;
  faceVisible: true;
  /** Head rotation, 0 when square-on to the camera. */
  yawDeg: number;
  pitchDeg: number;
  /** How long the model took on this frame, on the main thread. */
  inferenceMs: number;
};

export type MissingPresenceSample = {
  time: number;
  faceVisible: false;
  inferenceMs: number;
};

export type PresenceSample = VisiblePresenceSample | MissingPresenceSample;

/**
 * Where this person's head rests when looking at the patient. Every reading is
 * judged against this rather than against the camera, because the webcam sits
 * above the screen: looking at the patient means looking below it.
 */
export type PresenceBaseline = {
  yawDeg: number;
  pitchDeg: number;
};

export type CalibrationResult =
  | { ok: true; baseline: PresenceBaseline }
  | { ok: false; reason: "face-not-visible" | "too-much-movement" };

export type PresenceThresholds = {
  /** How far the head may turn sideways and still count as facing the patient. */
  yawToleranceDeg: number;
  /** How far the head may tilt up or down and still count. */
  pitchToleranceDeg: number;
};

/** Everything measured about one stretch of time, usually one listening or speaking window. */
export type PresenceWindowMetrics = {
  durationSec: number;
  faceVisibleRatio: number;
  /**
   * False when too little of the window had a visible face. Coaching must say
   * nothing about such a window: a dark room is not inattention.
   */
  reliable: boolean;
  /**
   * Share of the window with the head pointed at the patient. A lost face counts
   * as away. Says nothing about the eyes: glancing at a phone with the head held
   * still does not register, which is a known limit rather than a bug.
   */
  facingRatio: number;
  /** Separate times the head turned away from the patient. */
  lookAwayCount: number;
  longestLookAwaySec: number;
};

/**
 * What one turn measured, held on the trainee's message in this browser and never
 * saved to Firestore (see `messagesForStorage`). Null means that part wasn't
 * measured: a typed reply has no `speaking`, and a line read back with the
 * camera off has no `listening`. Time between the line ending and the trainee
 * replying isn't in either, because looking away to think is normal.
 */
export type TurnPresence = {
  /** While the other person's line was playing, or being read. */
  listening: PresenceWindowMetrics | null;
  /** While the trainee was recording their reply. */
  speaking: PresenceWindowMetrics | null;
};
