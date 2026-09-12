import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PerguntaOpcoes } from '../types';

interface Props {
  pergunta: PerguntaOpcoes;
  onAnswer: (opcao: string) => void;
}

/**
 * Renders a clarifying question from `validar/necessidade-informacoes` (or a
 * follow-up loop from `validar/resposta-necessidade`) as large tappable
 * option buttons.
 */
export function QuestionSheet({
  pergunta,
  onAnswer,
}: Props): React.JSX.Element {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.question}>{pergunta.texto}</Text>
          <ScrollView>
            {pergunta.opcoes.map((opcao) => (
              <Pressable
                key={opcao}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => onAnswer(opcao)}
                accessibilityRole="button"
                accessibilityLabel={opcao}
              >
                <Text style={styles.optionText}>{opcao}</Text>
              </Pressable>
            ))}
          </ScrollView>
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
    maxHeight: '70%',
  },
  question: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 16,
  },
  option: {
    borderWidth: 2,
    borderColor: '#1F6FEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  optionPressed: {
    backgroundColor: '#EAF1FF',
  },
  optionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F6FEB',
    textAlign: 'center',
  },
});
