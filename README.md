# @apoiocane/react-native-sdk (Cane SDK)

Cane SDK is an accessibility assistant for elderly users, embedded directly
inside partner apps (telemedicine, banking, pharmacy) as an `npm install`-able
React Native library. It detects when a user seems stuck on a screen and
offers guided visual + voice help -- with a privacy design that keeps every
byte of screen content on-device until the user explicitly asks for help.

## Why this exists (architecture pivot)

An earlier prototype (`frontend/` in the wider ApoioDigital monorepo, not
touched by this project) used Android's `AccessibilityService` to scrape
screens system-wide. That approach was deliberately abandoned:

- Google Play and Apple both restrict/ban apps that use accessibility
  services outside genuine severe-disability use cases.
- `AccessibilityService` has no equivalent on iOS.
- The old prototype also had real security bugs (cleartext HTTP, a
  hardcoded crypto key, plaintext passwords in query params) that this
  rewrite does not carry forward in any form.

This SDK instead scans **only the host app's own view hierarchy, from
inside the host app's own process**, via a native layout-listener
(`ViewTreeObserver.OnGlobalLayoutListener` on Android, `UIWindow` traversal
on iOS) -- never an OS-level accessibility service, and never anything
outside the partner app itself. No runtime OS permission prompt, no separate
app install for the end user.

## Public API

```ts
import { CaneSDK } from '@apoiocane/react-native-sdk';

CaneSDK.init({
  accessKey: string,
  options?: {
    voiceGuidance?: boolean, // default true
    hapticFeedback?: boolean, // default true
    inactivityTimeout?: 'auto' | { min: number, max: number }, // default 'auto'
    baseUrl?: string,
    heuristicConstants?: Partial<HeuristicConstants>,
    logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent', // default 'warn' in release, 'debug' in __DEV__
    onLog?: (entry: CaneLogEntry) => void,
  },
});

CaneSDK.registerUser({ userId: string }); // an anonymized hash the partner app already has

CaneSDK.registerCriticalScreen({ name: string }); // arms the inactivity heuristic on THIS screen only
CaneSDK.unregisterCriticalScreen(); // call on unmount/navigation away

CaneSDK.destroy(); // full teardown
```

### Required host integration: `CaneSDKHost`

React Native has no stable, architecture-version-safe way to inject a
floating overlay root purely imperatively, so the overlay UI needs one
explicit mount point. Wrap your app once, near the root:

```tsx
import { CaneSDKHost } from '@apoiocane/react-native-sdk';

export default function App() {
  return (
    <CaneSDKHost>
      <YourAppContent />
    </CaneSDKHost>
  );
}
```

`CaneSDKHost` is also:

- where the touch listener for the inactivity heuristic lives;
- the coordinate reference for the native scanners: its view carries
  `testID="cane-sdk-host"`, and every captured element is measured relative
  to it, so the Spotlight lines up regardless of status bar, notch or
  edge-to-edge mode.

## Inactivity heuristic -- privacy design

1. `registerCriticalScreen()` runs the native view-hierarchy scanner
   **exactly once, locally on-device**, counting interactive components and
   total visible text characters. **Nothing is sent to any backend at this
   point.**
2. A dynamic timeout is computed **locally**:
   ```
   estimatedMs = baseMs + interactiveComponentCount * perComponentMs + textCharCount / readingCharsPerMs
   ```
   calibrated for elderly reading speed (~130 wpm), then clamped to
   `options.inactivityTimeout.min`/`.max` if provided, or to the built-in
   defaults (15000ms / 45000ms) otherwise. All constants are overridable via
   `options.heuristicConstants` -- see `src/inactivity/constants.ts`.
3. A single JS timer is armed. The touch listener in `CaneSDKHost` resets
   that timer on **any** interaction. Nothing is scanned or transmitted while
   idle -- only a local timer ticks.
4. On timeout, a small local prompt appears ("Precisa de uma ajudinha para
   continuar?"). **Only if the user answers affirmatively** does the SDK
   take the already-captured (or freshly re-captured, if none is cached)
   element tree and send it to the backend to start the assist flow.
5. Net effect: **zero screen content leaves the device until explicit
   user opt-in.** Do not "simplify" this into periodic re-scanning or
   streaming layout changes to a backend.

The floating action button is the second, fully manual trigger path for the
same assist flow -- tapping it skips the idle prompt but still only sends
data as a direct result of that explicit tap.

## Backend contract

Base URL is configurable via `options.baseUrl`. Every request carries
`x-api-key: <accessKey>` and is implemented with plain `fetch`.

1. `POST /resposta/validar/necessidade-informacoes`
   Body: `{ userId, prompt, elementos }`
   Response: `{ interromper, pergunta: { texto, opcoes } | null, idPedido }`
2. `POST /resposta/validar/resposta-necessidade`
   Body: `{ userId, idPedido, resposta }`
   Response: same shape as (1); may loop back to another question.
3. `POST /resposta/achar-resposta`
   Body: `{ userId, prompt, elementos, idPedido }`
   Response: `{ viewID, mensagem_escrita, mensagem_voz_url: string | null, precisao, idResposta }`

Contract notes (aligned with the `backend-sdk` repo):

- **Clarification answers are used**: the SDK sends the `idPedido` of the
  clarification loop to `achar-resposta`; the backend appends every question
  and answer to the pedido prompt and uses it to pick the element. When no
  question was needed, the `idPedido` from (1) is still sent, so each assist
  creates a single pedido.
- **`pergunta.opcoes = []`** means a free-text answer; the `QuestionSheet`
  renders a text field in that case.
- **`mensagem_voz_url` can be `null`** when speech synthesis fails; the
  Spotlight then shows only the written message.
- **`idResposta`** is the parameter of `POST /componentes/comparar`
  (screen signature check).
- **Errors**: `401/403` (key rejected) suspends the SDK until the next
  `init()`; `429` (rate limit, see the backend README) and any other failure
  just hide the overlay for that attempt.
- **Timeout (open)**: `REQUEST_TIMEOUT_MS = 10s` in `src/network/ApiClient.ts`,
  while `achar-resposta` took 8-69 s against the local backend. The backend
  latency is the real fix; the contractual value still needs to be decided.

## Native view-hierarchy scanners

Both platforms walk the host app's own view tree, once per call, after a
short layout-settle debounce (400ms) **unrelated to and much shorter than**
the inactivity timer above.

- **Coordinates** are in dp (Android) / points (iOS), relative to the
  `CaneSDKHost` view -- the same frame the overlay draws in.
- **Maximum wait (Android)**: layout events restart the debounce, so the
  scan is capped at 1500ms; a screen that never stops animating still
  returns a result.
- **The SDK's own overlay is skipped (Android)**: the `OverlayRoot` subtree
  (`testID="cane-sdk-overlay"`: floating button, spinner, Spotlight) is not
  sent to the backend.
- **Secure field masking** happens in native code, before anything crosses
  the bridge: Android checks `EditText`'s password `InputType` variations;
  iOS checks `UITextField.isSecureTextEntry`. Masked fields always report
  `text: ""`.

**`viewId` resolution** (the two platforms do not use the same sources yet):

| Priority | Android | iOS |
|---|---|---|
| 1 | Resource id name (`R.id.*`; practically never set for RN views) | `accessibilityIdentifier` (RN `testID`) |
| 2 | `contentDescription` (RN `accessibilityLabel`) | `accessibilityLabel` |
| 3 | `view-<identityHashCode>` | `view-<ObjectIdentifier hash>` |

The fallback in row 3 is a per-instance value: it changes between app
launches, so it only correlates elements within a single assist. Setting
`accessibilityLabel` on the elements a partner wants to be spotlight-able
gives a stable id on both platforms.

Files:

- Android: `android/src/main/java/com/apoiocane/reactnativesdk/ViewHierarchyScanner.kt`
  + `ReactNativeSdkModule.kt` (TurboModule, `captureViewHierarchy()`).
- iOS: `ios/CaneViewScanner.swift` + `ios/ReactNativeSdk.mm` (ObjC++ glue).

Every native entry point resolves rather than rejects on failure (no current
Activity, scan exception, etc. all resolve to `[]`).

## Overlay / spotlight UI

Cross-platform React Native/TypeScript, under `src/overlay/`:

- `Spotlight.tsx` -- a layer inside `CaneSDKHost` (not a `Modal`) with a
  ~60%-opacity dark backdrop and a circular or rounded-rect cutout drawn with
  a `react-native-svg` mask. Only the dark area captures touches (and closes
  the help); the cutout is empty, so **the tap reaches the partner's
  highlighted button**, and finishing that tap also closes the Spotlight.
  Tapping the tooltip or pressing Android back closes it too.
- `spotlightGeometry.ts` -- cutout, touch areas and tooltip placement (unit
  tested).
- `Tooltip.tsx` -- large, high-contrast speech bubble above/below the cutout.
- `FloatingActionButton.tsx` -- the always-available manual trigger.
- `IdlePromptBubble.tsx` / `QuestionSheet.tsx` -- the idle nudge and the
  clarification question. The question sheet has a **Fechar** button and
  closes on Android back; closing it cancels the assist.
- `controller.ts` -- a small pub/sub state container connecting `CaneSDK` to
  `OverlayRoot`. Hiding the overlay releases any pending question (`null`) or
  idle prompt (`false`), so the assist flow never waits forever.

`options.hapticFeedback` gates a short `Vibration.vibrate()` pulse when the
Spotlight appears. The library manifest declares
`android.permission.VIBRATE` (a normal permission, no user prompt), which the
manifest merger adds to the host app. `options.voiceGuidance` gates
auto-playing `mensagem_voz_url` through `react-native-sound`.

### Peer dependencies

```
react-native-svg    (spotlight cutout mask)
react-native-sound  (mensagem_voz_url playback)
```

Both are **required** peer dependencies: Metro resolves `require()`/`import`
statically, so a missing peer fails the bundle build regardless of any
try/catch. The try/catch in `src/audio/AudioPlayer.ts` guards runtime
failures (bad URL, decode error). Partner apps must install both packages
(and run `pod install` on iOS).

## Fail-safe design

Hard requirement: scanning, networking and rendering must never crash or
block the host app; any failure makes the SDK hide itself and hand control
back to the host.

- `src/safety/safeguard.ts` -- `safeAsync`/`safeSync` wrap native scan calls,
  the heuristic cycle and the public methods.
- The assist flow (`startAssist`) always ends in `finally`: on any failure
  (network, timeout, HTTP error, invalid JSON -- all surfaced as
  `CaneApiError` with a `kind`) the overlay is hidden and a new assist can
  start right away.
- A `401`/`403` from the backend suspends the SDK (floating button and
  heuristic off, no further calls) until the next `init()`.
- `src/safety/SafeBoundary.tsx` -- a React error boundary around every piece
  of overlay UI, since try/catch cannot intercept render-phase exceptions.
- Every native bridge method resolves rather than rejects on failure.

## Logging

The SDK logs in release builds too:

- default level `warn` in release and `debug` in `__DEV__`; change it with
  `options.logLevel` (`'silent'` turns logging off);
- `warn`/`error` entries go to the console (logcat / os_log);
- `options.onLog` receives every emitted entry
  (`{ level, message, timestamp, error? }`) so the partner can forward it to
  their own crash reporter -- the reliable path, since many apps strip
  `console` from release builds;
- errors are reduced to `{ name, message, status?, kind? }`; no other error
  field and never the access key are logged. Swallowed exceptions and overlay
  render errors are `error`; expected assist failures are `warn`.

## Repo structure

```
src/                  TypeScript facade + overlay UI
  CaneSDK.ts           public facade singleton
  CaneSDKHost.tsx      render anchor, touch listener, coordinate reference
  internal.ts          indirection to avoid an import cycle between the two above
  types.ts             shared public types + backend contract types
  inactivity/          dynamic timeout estimator + timer
  native/              TurboModule wrapper (fail-safe)
  network/             ApiClient (plain fetch, the 3 backend endpoints)
  audio/               audio playback adapter (react-native-sound)
  overlay/             Spotlight/Tooltip/FAB/IdlePrompt/QuestionSheet + controller
  safety/              fail-safe wrappers, error boundary, logger
  __tests__/           jest unit tests
android/               Kotlin native module (ViewHierarchyScanner.kt, ReactNativeSdkModule.kt)
ios/                   Swift native module (CaneViewScanner.swift) + ObjC++ TurboModule glue
example/               Runnable example app (mock backend, two screens, full CaneSDK wiring)
```

## Verification status

- **Unit tests** (`yarn test`): 42 tests -- inactivity heuristic, timeout
  estimation, overlay controller, Spotlight geometry, logger and the assist
  flow (`CaneSDK.test.ts`, with the native scanner and `fetch` mocked:
  clarification `idPedido`, network failure, closing the question,
  unregistering mid-question, key suspension, `onLog`).
- **Typecheck and lint** (`yarn typecheck`, `yarn lint`): clean.
- **CI** (`.github/workflows/ci.yml`, on pushes and pull requests to `main`):
  lint, test, build-library, build-android and build-ios. The Android and
  iOS jobs compile the Kotlin and Swift code of the example app.
- **Not yet verified on a device or emulator**: scanner timing and
  coordinates, Spotlight alignment and touch pass-through, haptics and audio
  playback. This needs Android Studio (or a device) and a macOS/Xcode
  machine.

## Deviations from the spec (and why)

1. **`CaneSDKHost` component** (additive): rendering a floating overlay
   purely imperatively has no stable cross-architecture solution in React
   Native, so one mount point is required.
2. **`options.baseUrl`**, **`options.heuristicConstants`**,
   **`options.logLevel`** and **`options.onLog`** (additive, optional).
3. **`react-native-svg` and `react-native-sound` as required peer
   dependencies** -- see "Peer dependencies".
4. **Loop safety cap** (`MAX_QUESTION_LOOP_ITERATIONS = 6` in
   `src/CaneSDK.ts`): a misbehaving backend can never keep the clarification
   loop open forever.

Nothing above renames, removes, or changes the signature of `init`,
`registerUser`, `registerCriticalScreen`, `unregisterCriticalScreen`, or
`destroy`.

## What's left

- On-device QA of the native scanners and the Spotlight (see "Verification
  status").
- **Fresh screen reads**: the assist flow reuses the scan taken by
  `registerCriticalScreen()` when there is one, which can be stale if the
  screen changed (async data, React Navigation keeps previous screens
  mounted).
- **Stable `viewId`s**: the per-instance fallback breaks the backend's screen
  signature between launches, and Android ignores `testID`.
- **Hybrid capture for Jetpack Compose / SwiftUI**: both scanners walk the
  raw view tree only; Compose and SwiftUI publish structure through the
  in-process accessibility tree (`createAccessibilityNodeInfo()` /
  `accessibilityElements`), which the scanner does not read yet. This is not
  the OS-level AccessibilityService the project abandoned. WebViews have the
  same limitation.
- **Element-tree pruning before upload**: every visible node is sent today;
  dropping decorative nodes would cut input tokens on every agent call.
- **User intent**: both trigger paths send a fixed generic prompt; a typed or
  voice question would slot in as an argument of `startAssist`.

## Development

```sh
yarn install
yarn typecheck
yarn lint
yarn test
yarn prepare          # react-native-builder-bob build -> lib/module, lib/typescript
yarn example android  # requires a configured Android SDK
yarn example ios      # requires Xcode/macOS
```

## License

MIT
