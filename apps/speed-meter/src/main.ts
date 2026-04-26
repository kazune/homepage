type AppState = "idle" | "requesting" | "watching" | "error";

type Unit = "kmh";

type Sample = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

const displayUnit: Unit = "kmh";
const smoothingWindowSize = 3;

const speedElement = query("[data-speed]");
const stateElement = query("[data-state]");
const accuracyElement = query("[data-accuracy]");
const updatedElement = query("[data-updated]");
const messageElement = query("[data-message]");
const toggleButton = query<HTMLButtonElement>("[data-toggle]");

let appState: AppState = "idle";
let watchId: number | null = null;
let previousSample: Sample | null = null;
let speedSamples: number[] = [];

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function setState(nextState: AppState, message: string) {
  appState = nextState;
  messageElement.textContent = message;

  const stateText: Record<AppState, string> = {
    idle: "未開始",
    requesting: "許可待ち",
    watching: "計測中",
    error: "エラー",
  };

  stateElement.textContent = stateText[nextState];
  toggleButton.textContent = nextState === "watching" || nextState === "requesting" ? "停止" : "開始";
  toggleButton.disabled = false;
}

function convertSpeed(metersPerSecond: number, unit: Unit) {
  if (unit === "kmh") {
    return metersPerSecond * 3.6;
  }

  return metersPerSecond;
}

function formatSpeed(metersPerSecond: number) {
  return convertSpeed(metersPerSecond, displayUnit).toFixed(1);
}

function formatAccuracy(accuracy: number | null) {
  if (accuracy === null || !Number.isFinite(accuracy)) {
    return "--";
  }

  return `${Math.round(accuracy)} m`;
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function toRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function distanceMeters(from: Sample, to: Sample) {
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateSpeed(position: GeolocationPosition, sample: Sample) {
  if (typeof position.coords.speed === "number" && Number.isFinite(position.coords.speed)) {
    return Math.max(0, position.coords.speed);
  }

  if (!previousSample) {
    return null;
  }

  const elapsedSeconds = (sample.timestamp - previousSample.timestamp) / 1000;

  if (elapsedSeconds <= 0) {
    return null;
  }

  return distanceMeters(previousSample, sample) / elapsedSeconds;
}

function smoothedSpeed(metersPerSecond: number) {
  speedSamples = [...speedSamples, metersPerSecond].slice(-smoothingWindowSize);
  const total = speedSamples.reduce((sum, speed) => sum + speed, 0);

  return total / speedSamples.length;
}

function handlePosition(position: GeolocationPosition) {
  const sample: Sample = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    timestamp: position.timestamp,
  };
  const speed = estimateSpeed(position, sample);

  previousSample = sample;
  accuracyElement.textContent = formatAccuracy(position.coords.accuracy);
  updatedElement.textContent = formatTime(position.timestamp);

  if (speed === null) {
    speedElement.textContent = "0.0";
    setState("watching", "位置を取得しました。次の更新で速度を計算します。");
    return;
  }

  speedElement.textContent = formatSpeed(smoothedSpeed(speed));
  setState("watching", "移動速度を計測しています。");
}

function handleError(error: GeolocationPositionError) {
  const messages: Record<number, string> = {
    [error.PERMISSION_DENIED]: "位置情報の利用が許可されませんでした。",
    [error.POSITION_UNAVAILABLE]: "現在位置を取得できませんでした。",
    [error.TIMEOUT]: "位置情報の取得がタイムアウトしました。",
  };

  stopWatching(false);
  setState("error", messages[error.code] ?? "位置情報の取得に失敗しました。");
}

function resetMeasurements() {
  previousSample = null;
  speedSamples = [];
  speedElement.textContent = "0.0";
  accuracyElement.textContent = "--";
  updatedElement.textContent = "--";
}

function startWatching() {
  if (!("geolocation" in navigator)) {
    setState("error", "このブラウザは位置情報に対応していません。");
    return;
  }

  resetMeasurements();
  setState("requesting", "位置情報の許可を待っています。");

  watchId = navigator.geolocation.watchPosition(handlePosition, handleError, {
    enableHighAccuracy: true,
    maximumAge: 1000,
    timeout: 12000,
  });
}

function stopWatching(shouldResetState = true) {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  previousSample = null;
  speedSamples = [];

  if (shouldResetState) {
    setState("idle", "停止しました。開始すると位置情報を使って移動速度を表示します。");
  }
}

toggleButton.addEventListener("click", () => {
  if (appState === "watching" || appState === "requesting") {
    stopWatching();
    return;
  }

  startWatching();
});
