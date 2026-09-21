import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface Props {
  message: string;
  placement: 'above' | 'below';
}

export function Tooltip({ message, placement }: Props): React.JSX.Element {
  return (
    <View
      style={[
        styles.bubble,
        placement === 'above' ? styles.pointerDown : styles.pointerUp,
      ]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pointerDown: {},
  pointerUp: {},
  text: {
    color: '#111111',
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
  },
});
