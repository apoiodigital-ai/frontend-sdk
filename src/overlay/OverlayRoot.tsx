import React, { useSyncExternalStore } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { overlayController } from './controller';
import { FloatingActionButton } from './FloatingActionButton';
import { IdlePromptBubble } from './IdlePromptBubble';
import { QuestionSheet } from './QuestionSheet';
import { Spotlight } from './Spotlight';
import { SafeBoundary } from '../safety/SafeBoundary';

/**
 * Everything the SDK renders lives under here, and every piece is wrapped
 * in its own `SafeBoundary` so one broken subtree (say, a malformed
 * `pergunta` from the backend) can't take the FAB or the rest of the host
 * app down with it.
 */
export function OverlayRoot(): React.JSX.Element | null {
  const state = useSyncExternalStore(
    overlayController.subscribe,
    overlayController.getState,
    overlayController.getState
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
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
