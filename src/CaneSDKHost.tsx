import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { OverlayRoot } from './overlay/OverlayRoot';
import { overlayController } from './overlay/controller';
import { CANE_HOST_TEST_ID } from './overlay/testIds';
import { SafeBoundary } from './safety/SafeBoundary';
import { caneSDKInternal } from './internal';

interface Props {
  children: React.ReactNode;
}

export function CaneSDKHost({ children }: Props): React.JSX.Element {
  const lastActivityAt = useRef(0);

  const handleActivity = useCallback((_event: GestureResponderEvent) => {
    const now = Date.now();
    if (now - lastActivityAt.current < 200) return;
    lastActivityAt.current = now;
    caneSDKInternal.notifyUserActivity();
  }, []);

  const handleTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      handleActivity(event);
      overlayController.dismissSpotlight();
    },
    [handleActivity]
  );

  return (
    <View
      style={styles.fill}
      testID={CANE_HOST_TEST_ID}
      collapsable={false}
      onTouchStart={handleActivity}
      onTouchMove={handleActivity}
      onTouchEnd={handleTouchEnd}
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
