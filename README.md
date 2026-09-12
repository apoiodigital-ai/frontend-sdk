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
outside the partner app itself. No special OS permission, no separate app
install for the end user.

## Public API

The imperative surface is exactly this (do not rename these):

```ts
import { CaneSDK } from '@apoiocane/react-native-sdk';

CaneSDK.init({
  accessKey: string,
  options?: {
    voiceGuidance?: boolean, // default true
    hapticFeedback?: boolean, // default true
    inactivityTimeout?: 'auto' | { min: number, max: number }, // default 'auto'
  },
});

CaneSDK.registerUser({ userId: string }); // an anonymized hash the partner app already has

CaneSDK.registerCriticalScreen({ name: string }); // arms the inactivity heuristic on THIS screen only
CaneSDK.unregisterCriticalScreen(); // call on unmount/navigation away

CaneSDK.destroy(); // full teardown
```

### Required host integration: `CaneSDKHost`

React Native has no stable, architecture-version-safe way to inject a
floating overlay root purely imperatively (the unofficial "root siblings"
trick relies on `AppRegistry` internals that aren't guaranteed to keep
working across old/new-architecture RN versions). So the overlay UI needs
one small, explicit mount point. Wrap your app once, near the root:

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

This is additive -- it doesn't rename or replace any of the five methods
above. It's also where the (privacy-preserving, see below) touch/gesture
listener for the inactivity heuristic lives. See "Deviations from the spec"
for why this exists.

## Inactivity heuristic -- privacy design

This is the core, deliberately-designed piece, implemented in
`src/inactivity/InactivityHeuristic.ts` (the file itself carries the same
comment, so it survives refactors):

1. `registerCriticalScreen()` runs the native view-hierarchy scanner
   **exactly once, locally on-device**, counting interactive components and
   total visible text characters. **Nothing is sent to any backend at this
   point.**
2. A dynamic timeout is computed **locally**:
   ```
   estimatedMs = baseMs + interactiveComponentCount * perComponentMs + textCharCount / readingCharsPerMs
   ```
   calibrated for elderly reading speed (~130 wpm, deliberately slower than
   the ~200-250 wpm average adult reading speed), then clamped to
   `options.inactivityTimeout.min`/`.max` if provided, or to the built-in
   defaults (15000ms / 45000ms) otherwise. All constants are overridable via
   `options.heuristicConstants` -- see `src/inactivity/constants.ts`.
3. A single JS timer is armed. A touch/gesture listener (living in
   `CaneSDKHost`) resets that timer on **any** interaction. Nothing is
   scanned or transmitted while idle -- only a local timer ticks.
4. On timeout, a small local prompt appears ("Precisa de uma ajudinha para
   continuar?"). **Only if the user answers affirmatively** does the SDK
   take the already-captured (or freshly re-captured, if none is cached)
   element tree and send it to the backend to start the real assist flow.
5. Net effect: **zero screen content leaves the device until explicit
   user opt-in after the idle prompt.** This is a deliberate, client-agreed
   architecture decision, not an oversight -- do not "simplify" it into
   periodic re-scanning or streaming layout changes to a backend.

The floating action button (see below) is the second, fully manual trigger
path for the same assist flow -- tapping it skips the idle-prompt step but
still only sends data as a direct result of that explicit tap.

## Backend contract

Base URL is configurable via `options.baseUrl` (falls back to a
placeholder default -- see `src/network/ApiClient.ts`). Every request
carries `x-api-key: <accessKey>`. Implemented with plain `fetch` --
deliberately no axios or other HTTP client, to keep the SDK bundle small.

1. `POST /resposta/validar/necessidade-informacoes`
   Body: `{ userId, prompt, elementos: [...captured tree...] }`
   Response: `{ interromper: boolean, pergunta?: { texto: string, opcoes: string[] } }`
2. `POST /resposta/validar/resposta-necessidade`
   Body: `{ userId, idPedido, resposta: string }`
   Response: `{ interromper: boolean, ... }` (may loop back to another question, or proceed)
3. `POST /resposta/achar-resposta`
   Body: `{ userId, prompt, elementos: [...] }`
   Response: `{ viewID: string, mensagem_escrita: string, mensagem_voz_url: string, precisao: number }`

**Backend contract status (alinhado com o repo `backend-sdk` em
12/09/2026):**

- ~~`idPedido` gap~~ **resolvido**: o backend emite `idPedido` nas
  respostas de (1) e (2); a leitura defensiva em `src/CaneSDK.ts` continua
  valendo como fail-safe.
- ~~Shape de `elementos` divergente~~ **resolvido no backend**: o backend
  agora desserializa exatamente o shape que este SDK envia
  (`CapturedElementDTO`, espelho de `CapturedElement`), e o `viewID` da
  resposta de `achar-resposta` é o mesmo `viewId` string capturado aqui —
  o lookup no índice local volta a funcionar.
- ~~Identidade do usuário~~ **resolvido no backend**: `userId` (o hash
  anônimo do parceiro que `registerUser` repassa) agora é aceito como
  string e auto-provisionado por tenant na primeira chamada — este SDK
  continua sem precisar chamar `POST /usuario/registrar`.
- ~~Loop de follow-up sem opções~~ **resolvido aqui**: o `QuestionSheet`
  renderiza um campo de texto livre + botão "Enviar resposta" quando
  `pergunta.opcoes` vem vazio (contrato do backend para resposta aberta).
- **Timeout** (pendente, menor): `REQUEST_TIMEOUT_MS = 10s` aqui vs.
  fail-safe de 2s prometido no doc V2 §5.5 (latência típica declarada:
  650ms P95). Decidir o valor contratual e alinhar.
- As correções do backend ainda não foram compiladas (sem JDK 17 na
  máquina de dev) — o contrato acima precisa de um teste de integração
  real antes do primeiro piloto.

## Native view-hierarchy scanners

Both platforms implement the same contract: walk the host app's own view
tree, once per call, after a short (300-500ms) layout-settle debounce
**unrelated to and much shorter than** the inactivity timer above -- this
debounce only exists to avoid reading mid-animation.

**`viewId` resolution priority** (same order both platforms, so a partner
app can reason about it once):
1. A real native resource id, if present and resolvable (Android
   `R.id.*` / `getResourceEntryName`; effectively never populated for
   RN-rendered views).
2. `contentDescription` (Android) / `accessibilityIdentifier` then
   `accessibilityLabel` (iOS) -- populated by RN's `accessibilityLabel` /
   `testID` props respectively. Practical recommendation for partner apps:
   set `accessibilityLabel` on elements you want to be spotlight-able --
   it's both a real accessibility improvement and a stable Cane SDK target
   id "for free."
3. A synthetic per-instance fallback (stable only within a single scan).

**Secure field masking** happens entirely in native code, before anything
crosses the bridge: Android checks `EditText`'s `InputType` variation
(`TYPE_TEXT_VARIATION_PASSWORD`/`WEB_PASSWORD`/`VISIBLE_PASSWORD`,
`TYPE_NUMBER_VARIATION_PASSWORD`); iOS checks `UITextField.isSecureTextEntry`.
Masked fields always report `text: ""`.

- Android: `android/src/main/java/com/apoiocane/reactnativesdk/ViewHierarchyScanner.kt`
  (walk logic) + `ReactNativeSdkModule.kt` (TurboModule bridge,
  `captureViewHierarchy(): Promise<CapturedElementNative[]>`).
- iOS: `ios/CaneViewScanner.swift` (walk logic, `UIWindow` traversal per the
  spec's `view.convert(view.bounds, to: window)` approach) +
  `ios/ReactNativeSdk.mm` (ObjC++ TurboModule glue, imports the
  Xcode-generated `ReactNativeSdk-Swift.h` umbrella header).
- Bridged as a single TurboModule (`react-native-codegen`, new architecture)
  -- this is what `create-react-native-library`/`react-native-builder-bob`
  scaffolds by default for RN 0.86.2, the version this repo was generated
  against.

Every native entry point resolves rather than rejects/throws on failure
(no current Activity, scan exception, etc. all resolve to `[]`) -- see
"Fail-safe design."

## Overlay / spotlight UI

Cross-platform React Native/TypeScript, under `src/overlay/`:

- `Spotlight.tsx` -- full-screen `Modal`, ~60%-opacity dark backdrop, with a
  circular or rounded-rect cutout drawn via an `react-native-svg` mask
  (`Mask`/`Rect`/`Circle`) positioned exactly over the target element's
  cached coordinates.
- `Tooltip.tsx` -- large, high-contrast speech-bubble typography above/below
  the cutout.
- `FloatingActionButton.tsx` -- the always-available manual trigger path.
- `IdlePromptBubble.tsx` / `QuestionSheet.tsx` -- the local idle nudge and
  the backend clarification-question loop, respectively.
- `controller.ts` -- a small, dependency-free pub/sub state container
  connecting `CaneSDK` (the facade) to `OverlayRoot` (what `CaneSDKHost`
  renders), so neither package needs to import the other directly.

`options.hapticFeedback` gates a short `Vibration.vibrate()` pulse
(core React Native API -- deliberately not an extra native haptics
library, same "keep the bundle small" reasoning as the HTTP client choice)
on cutout reveal. `options.voiceGuidance` gates auto-playing
`mensagem_voz_url` through `react-native-sound`.

### Peer dependencies

```
react-native-svg    (spotlight cutout mask)
react-native-sound   (mensagem_voz_url playback)
```

Both are declared as **required** peer dependencies, not optional ones.
An earlier draft of this SDK tried to treat `react-native-sound` as a
soft/optional dependency (lazy `require` behind a try/catch). That's
wrong for React Native: Metro resolves `require()`/`import` statically
when building the bundle, before any of that code runs, so an actually-
missing peer dependency fails the bundle build regardless of the
try/catch. The try/catch in `src/audio/AudioPlayer.ts` still guards real
runtime failures (bad URL, decode error) -- it just can't make the
dependency optional in the way an earlier comment claimed. Partner apps
must install both packages (and, per usual RN convention, run
`pod install` for the iOS native side of `react-native-svg`/
`react-native-sound`).

`react-native-sound` was chosen over `expo-av`/`expo-audio` because it
works in a bare RN app without pulling in `expo-modules-core`, a much
bigger ask for partner apps that aren't already on Expo.

## Fail-safe design

Hard requirement: scanning, networking, and rendering must never crash or
visibly break the host app; any failure anywhere should make the SDK
quietly hide itself and hand full control back to the host. This is
implemented as two consistent choke points rather than ad hoc try/catch:

- `src/safety/safeguard.ts` -- `safeAsync`/`safeSync` wrap every
  async/sync operation (native scan calls, every network request, the
  heuristic arm/reset/disarm cycle, the whole `startAssist` flow).
- `src/safety/SafeBoundary.tsx` -- a React error boundary wrapping every
  piece of overlay UI individually (`OverlayRoot.tsx`), since try/catch
  cannot intercept exceptions thrown during React's render phase. One
  broken subtree (e.g. a malformed `pergunta` from the backend) hides
  itself without taking the FAB or the rest of the host app's UI down
  with it.
- Every native bridge method (`ReactNativeSdkModule.kt`,
  `ReactNativeSdk.mm`) resolves rather than rejects on internal failure.

## Repo structure

```
src/                  TypeScript facade + overlay UI
  CaneSDK.ts           public facade singleton
  CaneSDKHost.tsx       render anchor + activity listener (see "Deviations")
  internal.ts           tiny indirection to avoid an import cycle between the two above
  types.ts              shared public types + backend contract types
  inactivity/           dynamic timeout estimator + timer (privacy-critical, heavily commented)
  native/                TurboModule wrapper (fail-safe)
  network/               ApiClient (plain fetch, the 3 backend endpoints)
  audio/                 audio playback adapter (react-native-sound)
  overlay/               Spotlight/Tooltip/FAB/IdlePrompt/QuestionSheet + controller
  safety/                fail-safe wrapper + error boundary + logger
  __tests__/             jest unit tests (pure-logic pieces; see "Verification status")
android/                Kotlin native module (ViewHierarchyScanner.kt, ReactNativeSdkModule.kt)
ios/                    Swift native module (CaneViewScanner.swift) + ObjC++ TurboModule glue
example/                Runnable example app (mock backend, two screens, full CaneSDK wiring)
```

## Verification status -- what actually compiles/runs here vs. what doesn't

This was built and verified in a **Windows environment with no Android
SDK/emulator and no Xcode/macOS available.** Be precise about what that
does and doesn't cover:

**Verified in this environment (commands below, all run clean):**
- `yarn typecheck` (`tsc --noEmit`) -- 0 errors, across `src/`, `example/`,
  and the test files.
- `yarn lint` (ESLint + Prettier via `@react-native/eslint-config`) -- 0
  errors, 0 warnings.
- `yarn test` (Jest) -- 20 passing unit tests covering the inactivity-
  heuristic timer (`InactivityHeuristic.test.ts`, using fake timers to
  assert arm/reset/disarm/one-shot-fire behavior), the timeout-estimation
  math and clamping (`estimator.test.ts`), and the overlay state machine
  (`controller.test.ts`).
- `yarn prepare` (`react-native-builder-bob build`) -- the actual library
  build: compiles all of `src/` with Babel to `lib/module/*.js` and
  generates `.d.ts` type definitions to `lib/typescript/*` via `tsc`. This
  is what actually gets published to npm; it completed with no errors.
- **Metro bundling of the example app**, for both platforms, e.g.:
  ```sh
  cd example
  npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/out.android.bundle
  npx react-native bundle --platform ios     --dev false --entry-file index.js --bundle-output /tmp/out.ios.bundle
  ```
  Both produced a complete (~1MB) JS bundle with no module-resolution
  errors -- this proves the entire JS dependency graph (including
  `react-native-svg`, the `react-native-sound` lazy require, and the
  TurboModule spec import) is valid and would load on a real device. It
  does **not** prove runtime correctness (no emulator/device was available
  to actually execute the bundle).

**NOT verified -- blocked by this environment's tooling gaps:**
- **Android native build.** `ANDROID_HOME`/`JAVA_HOME` are unset, no
  Android SDK was found anywhere on this machine, and the only JDK present
  is 1.8 (the project's `android/build.gradle` requires
  `sourceCompatibility JavaVersion.VERSION_17`). `ViewHierarchyScanner.kt`
  and `ReactNativeSdkModule.kt` have **not** been compiled by Gradle/Kotlin,
  and RN's codegen (which generates `NativeReactNativeSdkSpec` from
  `src/NativeReactNativeSdk.ts`) has never actually run -- so the exact
  generated Kotlin interface shape (in particular, whether a
  `Promise<Array<Object>>`-shaped return type codegens exactly as written)
  is unconfirmed. The Kotlin is written carefully and follows established
  TurboModule patterns, but treat it as unverified until someone with the
  Android SDK installed runs `cd example && yarn android` (or at least
  `cd android && ./gradlew compileDebugKotlin`).
- **iOS build**, entirely. No Xcode/macOS is available in this environment
  at all. `ios/CaneViewScanner.swift` and the updated `ios/ReactNativeSdk.mm`
  /`ReactNativeSdk.podspec` have never been compiled, and the
  Swift-to-Objective-C++ bridging (the auto-generated
  `ReactNativeSdk-Swift.h` umbrella header, `s.swift_version`,
  `DEFINES_MODULE`) is a real, well-established RN/CocoaPods pattern but is
  **unverified** here. Someone with Xcode needs to run `cd example && npx pod-install && yarn ios`
  (or open `example/ios/ReactNativeSdkExample.xcworkspace` directly) before
  this can be trusted.
- **On-device/emulator runtime behavior** for anything native: the actual
  layout-listener debounce timing, coordinate conversion correctness, the
  spotlight cutout rendering against real captured coordinates, haptic
  feedback, and audio playback have not been exercised end-to-end on a
  real device.

## Deviations from the spec (and why)

1. **`CaneSDKHost` component** (additive, not a rename): the spec lists
   only the five imperative methods. Rendering a floating overlay/FAB
   purely imperatively has no stable cross-architecture-version solution
   in React Native, so one small mount point is required. See "Required
   host integration" above.
2. **`options.baseUrl`** added to `CaneSDKOptions` (additive): the spec
   says the base URL is "configurable at init... or via a sensible default
   + override option" but doesn't specify where that option lives; it's a
   sibling of `voiceGuidance`/`hapticFeedback`/`inactivityTimeout`.
3. **`options.heuristicConstants`** added (additive, optional): exposes the
   base/per-component/reading-speed constants for tuning, since the spec
   explicitly calls these "sane defaults" that should be
   "configurable/overridable."
4. **`react-native-svg` and `react-native-sound` as required (not
   optional) peer dependencies** -- see "Peer dependencies" above for why
   a truly-optional soft dependency isn't achievable given Metro's static
   module resolution.
5. **Backend `idPedido` handled defensively** -- see "Backend contract
   gap" above; this is a request for backend-side confirmation, not a
   unilateral change to the contract.
6. **Loop safety cap** (`MAX_QUESTION_LOOP_ITERATIONS = 6` in
   `src/CaneSDK.ts`): the spec describes the clarification loop as
   open-ended ("may loop back to another question... or proceed"). A hard
   cap was added so a misbehaving backend can never spin the SDK/overlay
   forever -- consistent with the fail-safe requirement.

Nothing above renames, removes, or changes the signature of `init`,
`registerUser`, `registerCriticalScreen`, `unregisterCriticalScreen`, or
`destroy`.

## What's left / blocked

- Real Android and iOS builds (see "Verification status") -- needs the
  Android SDK + JDK 17 and a macOS/Xcode machine respectively.
- On-device QA of the native scanners (coordinate accuracy, debounce
  feel, secure-field masking against real system keyboards).
- ~~Backend team confirmation of the `idPedido` gap~~ resolved -- and the
  former blockers (`elementos` shape, user identity, empty `opcoes`) are
  now aligned too; see "Backend contract status" above. What remains is
  an end-to-end integration test against a running backend.
- **Hybrid capture engine for Jetpack Compose / SwiftUI**: both scanners
  walk the raw view tree only. On a Compose screen (`ComposeView`) or a
  SwiftUI host (`UIHostingController`) that walk returns almost nothing
  usable -- those engines only publish structure through the
  semantics/accessibility tree. Planned direction (decisao registrada em
  conversa de arquitetura, set/2026): keep the view-tree walk as primary
  and switch to the in-process accessibility tree
  (`View.createAccessibilityNodeInfo()` / `accessibilityElements`) for
  those subtrees -- this is NOT the OS-level AccessibilityService the
  project abandoned; it needs no permission and reads only the host app.
  Fail-safe already covers the interim: an empty scan means no overlay.
  PoC should cover all 4 quadrants (Android View, Compose, UIKit, SwiftUI).
- **Element-tree pruning before upload**: today every visible node is
  sent; dropping decorative/non-interactive nodes before serialization
  would cut input tokens on every one of the backend's agent calls
  (multiplicative saving -- flagged in the cost review).
- No free-text input for "what do you need help with" -- both trigger
  paths (idle-timeout opt-in and the FAB) currently send a fixed generic
  prompt string (see `DEFAULT_IDLE_PROMPT`/`DEFAULT_MANUAL_PROMPT` in
  `src/CaneSDK.ts`); a richer input (typed or voice-to-text) was out of
  scope for this build but would slot in as an additional argument to the
  same `startAssist` internal method.
- `example/ios` and `example/android` are the stock
  `create-react-native-library` scaffolding (RN 0.86.2, new architecture)
  and have not been hand-verified beyond what's listed above.

## Development

```sh
yarn install       # installs the workspace (root + example)
yarn typecheck      # tsc --noEmit
yarn lint           # eslint + prettier
yarn test           # jest unit tests
yarn prepare        # react-native-builder-bob build -> lib/module, lib/typescript
yarn example android  # requires a configured Android SDK (not available in this environment)
yarn example ios      # requires Xcode/macOS (not available in this environment)
```

## License

MIT
