import React, { useEffect, useMemo, useRef } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import type { AcharRespostaResponse } from '../types';
import type { ElementBounds } from './types';
import { Tooltip } from './Tooltip';
import { audioPlayer } from '../audio/AudioPlayer';
import { safeAsync } from '../safety/safeguard';
import { logger } from '../safety/logger';

interface Props {
  answer: AcharRespostaResponse;
  bounds: ElementBounds | null;
  voiceGuidance: boolean;
  hapticFeedback: boolean;
  onDismiss: () => void;
}

const OVERLAY_OPACITY = 0.6;
const CUTOUT_PADDING = 10;

export function Spotlight({
  answer,
  bounds,
  voiceGuidance,
  hapticFeedback,
  onDismiss,
}: Props): React.JSX.Element {
  const { width: screenW, height: screenH } = useMemo(
    () => Dimensions.get('window'),
    []
  );
  const hasPlayedAudio = useRef(false);
  const hasHapticFired = useRef(false);

  useEffect(() => {
    if (hapticFeedback && !hasHapticFired.current) {
      hasHapticFired.current = true;
      try {
        Vibration.vibrate(40);
      } catch (error) {
        logger.warn('Haptic feedback failed -- continuing without it.', error);
      }
    }
  }, [hapticFeedback]);

  useEffect(() => {
    if (!voiceGuidance || hasPlayedAudio.current || !answer.mensagem_voz_url)
      return;
    hasPlayedAudio.current = true;
    safeAsync(
      () => audioPlayer.play(answer.mensagem_voz_url),
      'overlay.Spotlight.audioPlayback'
    );

    return () => {
      audioPlayer.stop();
    };
  }, [voiceGuidance, answer.mensagem_voz_url]);

  const cutout = bounds
    ? {
        x: Math.max(bounds.x - CUTOUT_PADDING, 0),
        y: Math.max(bounds.y - CUTOUT_PADDING, 0),
        width: bounds.width + CUTOUT_PADDING * 2,
        height: bounds.height + CUTOUT_PADDING * 2,
      }
    : null;

  const tooltipPlacement: 'above' | 'below' =
    cutout && cutout.y > screenH / 2 ? 'above' : 'below';

  const tooltipTop = cutout
    ? tooltipPlacement === 'below'
      ? cutout.y + cutout.height + 16
      : Math.max(cutout.y - 140, 24)
    : screenH / 2 - 60;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityLabel="Fechar ajuda"
      >
        <Svg width={screenW} height={screenH} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask
              id="cane-spotlight-mask"
              x={0}
              y={0}
              width={screenW}
              height={screenH}
            >
              <Rect x={0} y={0} width={screenW} height={screenH} fill="white" />
              {cutout ? (
                cutout.width === cutout.height ? (
                  <Circle
                    cx={cutout.x + cutout.width / 2}
                    cy={cutout.y + cutout.height / 2}
                    r={cutout.width / 2}
                    fill="black"
                  />
                ) : (
                  <Rect
                    x={cutout.x}
                    y={cutout.y}
                    width={cutout.width}
                    height={cutout.height}
                    rx={16}
                    ry={16}
                    fill="black"
                  />
                )
              ) : null}
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={screenW}
            height={screenH}
            fill={`rgba(0,0,0,${OVERLAY_OPACITY})`}
            mask="url(#cane-spotlight-mask)"
          />
        </Svg>
      </Pressable>

      <View
        style={[styles.tooltipContainer, { top: tooltipTop }]}
        pointerEvents="box-none"
      >
        <Tooltip
          message={answer.mensagem_escrita}
          placement={tooltipPlacement}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
});
