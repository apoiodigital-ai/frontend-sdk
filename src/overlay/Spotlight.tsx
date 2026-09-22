import React, { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Vibration,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, Mask, Rect, Circle } from 'react-native-svg';
import type { AcharRespostaResponse } from '../types';
import type { ElementBounds } from './types';
import { Tooltip } from './Tooltip';
import {
  computeCutout,
  computeDismissAreas,
  computeTooltipPlacement,
  type OverlayArea,
} from './spotlightGeometry';
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

export function Spotlight({
  answer,
  bounds,
  voiceGuidance,
  hapticFeedback,
  onDismiss,
}: Props): React.JSX.Element {
  const [area, setArea] = useState<OverlayArea | null>(null);
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

  const audioUrl = answer.mensagem_voz_url;

  useEffect(() => {
    if (!voiceGuidance || hasPlayedAudio.current || !audioUrl) return;
    hasPlayedAudio.current = true;
    safeAsync(
      () => audioPlayer.play(audioUrl),
      'overlay.Spotlight.audioPlayback'
    );
    return () => {
      audioPlayer.stop();
    };
  }, [voiceGuidance, audioUrl]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onDismiss();
        return true;
      }
    );
    return () => subscription.remove();
  }, [onDismiss]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setArea({ width, height });
  };

  const cutout = computeCutout(bounds);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={handleLayout}
    >
      {area ? (
        <>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={area.width} height={area.height}>
              <Defs>
                <Mask
                  id="cane-spotlight-mask"
                  x={0}
                  y={0}
                  width={area.width}
                  height={area.height}
                >
                  <Rect
                    x={0}
                    y={0}
                    width={area.width}
                    height={area.height}
                    fill="white"
                  />
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
                width={area.width}
                height={area.height}
                fill={`rgba(0,0,0,${OVERLAY_OPACITY})`}
                mask="url(#cane-spotlight-mask)"
              />
            </Svg>
          </View>

          {computeDismissAreas(area, cutout).map((dismissArea) => (
            <Pressable
              key={dismissArea.key}
              style={[
                styles.dismissArea,
                {
                  left: dismissArea.left,
                  top: dismissArea.top,
                  width: dismissArea.width,
                  height: dismissArea.height,
                },
              ]}
              onPress={onDismiss}
              accessible={false}
              importantForAccessibility="no"
            />
          ))}

          <SpotlightTooltip
            area={area}
            bounds={bounds}
            message={answer.mensagem_escrita}
            onDismiss={onDismiss}
          />
        </>
      ) : null}
    </View>
  );
}

function SpotlightTooltip({
  area,
  bounds,
  message,
  onDismiss,
}: {
  area: OverlayArea;
  bounds: ElementBounds | null;
  message: string;
  onDismiss: () => void;
}): React.JSX.Element {
  const { placement, top } = computeTooltipPlacement(
    area,
    computeCutout(bounds)
  );
  return (
    <View style={[styles.tooltipContainer, { top }]} pointerEvents="box-none">
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={message}
        accessibilityHint="Toque para fechar a ajuda"
      >
        <Tooltip message={message} placement={placement} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dismissArea: {
    position: 'absolute',
  },
  tooltipContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
});
