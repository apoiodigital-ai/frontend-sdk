import React, { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { overlayController } from './controller';
import { FloatingActionButton } from './FloatingActionButton';
import { IdlePromptBubble } from './IdlePromptBubble';
import { QuestionSheet } from './QuestionSheet';
import { Spotlight } from './Spotlight';
import { SafeBoundary } from '../safety/SafeBoundary';
import { CANE_OVERLAY_TEST_ID } from './testIds';

export function OverlayRoot(): React.JSX.Element | null {
  const state = useSyncExternalStore(
    overlayController.subscribe,
    overlayController.getState,
    overlayController.getState
  );

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      testID={CANE_OVERLAY_TEST_ID}
      collapsable={false}
    >
      {state.fabVisible ? (
        <SafeBoundary>
          <FloatingActionButton
            onPress={() => overlayController.triggerManualAssist()}
          />
        </SafeBoundary>
      ) : null}

      <SafeBoundary>
        {state.screen.kind === 'idlePrompt' ? (
          <IdlePromptBubble
            onAnswer={(yes) => {
              overlayController.resolveIdlePrompt(yes);
            }}
          />
        ) : null}
      </SafeBoundary>

      <SafeBoundary>
        {state.screen.kind === 'question' ? (
          <QuestionSheet
            pergunta={state.screen.pergunta}
            onAnswer={(opcao) => overlayController.answerQuestion(opcao)}
            onCancel={() => overlayController.cancelQuestion()}
          />
        ) : null}
      </SafeBoundary>

      <SafeBoundary>
        {state.screen.kind === 'spotlight' ? (
          <Spotlight
            answer={state.screen.answer}
            bounds={state.screen.bounds}
            voiceGuidance={state.voiceGuidance}
            hapticFeedback={state.hapticFeedback}
            onDismiss={() => overlayController.hideScreen()}
          />
        ) : null}
      </SafeBoundary>

      <SafeBoundary>
        {state.screen.kind === 'loading' ? (
          <View style={styles.loadingContainer} pointerEvents="none">
            <ActivityIndicator size="small" color="#1F6FEB" />
          </View>
        ) : null}
      </SafeBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    position: 'absolute',
    right: 24,
    bottom: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 8,
    elevation: 4,
  },
});
