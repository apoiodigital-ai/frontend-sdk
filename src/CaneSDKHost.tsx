import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { OverlayRoot } from './overlay/OverlayRoot';
import { SafeBoundary } from './safety/SafeBoundary';
import { caneSDKInternal } from './internal';

interface Props {
  children: React.ReactNode;
}

/**
 * Mount this ONCE near the root of your app, wrapping your existing content:
 *
 *   <CaneSDKHost>
 *     <App />
 *   </CaneSDKHost>
 *
 * Why this exists (deviation from the literal 5-method spec): React Native
 * has no stable, architecture-version-safe way to inject a floating overlay
 * root purely imperatively (the unofficial "root siblings" trick relies on
 * `AppRegistry` internals that aren't guaranteed across old/new architecture
 * versions). Every method name in the original contract
 * (`init`/`registerUser`/`registerCriticalScreen`/`unregisterCriticalScreen`/
 * `destroy`) is unchanged; this is additive plumbing so the overlay UI has
 * somewhere to render, not a replacement for any of them.
 *
 * This wrapper is also where the inactivity heuristic's touch/gesture
 * listener lives: `onTouchStart`/`onTouchMove` here observe touches
 * bubbling up through the tree WITHOUT claiming the responder, so normal
 * buttons/inputs inside `children` keep working completely normally -- see
 * the privacy/architecture note in `src/inactivity/InactivityHeuristic.ts`
 * for why this only ever resets a local timer and never triggers a scan or
 * network call by itself.
 */
export function CaneSDKHost({ children }: Props): React.JSX.Element {
  const lastActivityAt = useRef(0);

  const handleActivity = useCallback((_event: GestureResponderEvent) => {
    // Cheap debounce so a drag gesture doesn't call reset() on every pixel
    // of movement -- this is just about not doing redundant work, it has
    // nothing to do with the (unrelated, much longer) inactivity timeout.
    const now = Date.now();
    if (now - lastActivityAt.current < 200) return;
    lastActivityAt.current = now;
    caneSDKInternal.notifyUserActivity();
  }, []);

  return (
    <View
      style={styles.fill}
      onTouchStart={handleActivity}
      onTouchMove={handleActivity}
      onTouchEnd={handleActivity}
    >
      {children}
      <SafeBoundary>
        <OverlayRoot />
      </SafeBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
