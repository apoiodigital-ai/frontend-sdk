import React from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface Props {
  onPress: () => void;
}

/**
 * Always-available "ask for help" affordance -- the second trigger path
 * alongside the automatic inactivity heuristic. Bottom-right, thumb-reachable,
 * large hit target for the elderly-user audience.
 */
export function FloatingActionButton({ onPress }: Props): React.JSX.Element {
  const handlePress = (): void => {
    AccessibilityInfo.announceForAccessibility?.('Abrindo ajuda do Cane');
    onPress();
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Pedir ajuda"
        hitSlop={12}
      >
        <Text style={styles.icon}>?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    bottom: 32,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1F6FEB',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
});
