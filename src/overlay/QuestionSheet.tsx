import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { PerguntaOpcoes } from '../types';

interface Props {
  pergunta: PerguntaOpcoes;
  onAnswer: (opcao: string) => void;
}

export function QuestionSheet({
  pergunta,
  onAnswer,
}: Props): React.JSX.Element {
  const [freeText, setFreeText] = useState('');
  const isOpenQuestion = pergunta.opcoes.length === 0;
  const trimmed = freeText.trim();

  return (
    <Modal transparent animationType="slide" visible onRequestClose={() => {}}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.question}>{pergunta.texto}</Text>
          {isOpenQuestion ? (
            <View>
              <TextInput
                style={styles.input}
                value={freeText}
                onChangeText={setFreeText}
                placeholder="Escreva sua resposta aqui"
                placeholderTextColor="#8A8A8A"
                multiline
                accessibilityLabel="Escreva sua resposta aqui"
                testID="cane-question-free-text"
              />
              <Pressable
                style={({ pressed }) => [
                  styles.submit,
                  trimmed.length === 0 && styles.submitDisabled,
                  pressed && trimmed.length > 0 && styles.submitPressed,
                ]}
                onPress={() => {
                  if (trimmed.length > 0) {
                    onAnswer(trimmed);
                  }
                }}
                disabled={trimmed.length === 0}
                accessibilityRole="button"
                accessibilityLabel="Enviar resposta"
                testID="cane-question-submit"
              >
                <Text style={styles.submitText}>Enviar resposta</Text>
              </Pressable>
            </View>
          ) : (
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
          )}
        </View>
      </KeyboardAvoidingView>
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
  input: {
    borderWidth: 2,
    borderColor: '#1F6FEB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    color: '#111111',
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submit: {
    backgroundColor: '#1F6FEB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  submitDisabled: {
    backgroundColor: '#A9C4F5',
  },
  submitPressed: {
    backgroundColor: '#1657C4',
  },
  submitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
