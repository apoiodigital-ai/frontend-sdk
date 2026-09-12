import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  onAnswer: (yes: boolean) => void;
}

/**
 * The proactive-by-hesitation prompt. Purely local UI at this point -- no
 * network call has happened yet (see privacy note in `InactivityHeuristic.ts`).
 * Only a "Sim" tap here causes anything to be sent to the backend.
 */
export function IdlePromptBubble({ onAnswer }: Props): React.JSX.Element {
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={() => onAnswer(false)}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.question}>
            Precisa de uma ajudinha para continuar?
          </Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.button, styles.secondary]}
              onPress={() => onAnswer(false)}
              accessibilityRole="button"
              accessibilityLabel="Não, obrigado"
            >
              <Text style={styles.secondaryText}>Não, obrigado</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primary]}
              onPress={() => onAnswer(true)}
              accessibilityRole="button"
              accessibilityLabel="Sim, por favor"
            >
              <Text style={styles.primaryText}>Sim, por favor</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: '#1F6FEB',
  },
  secondary: {
    backgroundColor: '#EDEDED',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryText: {
    color: '#333333',
    fontSize: 18,
    fontWeight: '700',
  },
});
