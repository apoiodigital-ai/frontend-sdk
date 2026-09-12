import { logger } from '../safety/logger';

/**
 * Lightweight audio playback for `mensagem_voz_url`.
 *
 * `react-native-sound` is a REQUIRED peer dependency (see README "Peer
 * dependencies"), not a soft-optional one, even though the `require()` below
 * is guarded by try/catch. That guard only protects against RUNTIME
 * failures (bad URL, decode error, native module not yet linked on a stale
 * build) -- it can't make the dependency truly optional, because Metro
 * resolves `require()`/`import` calls statically when building the bundle,
 * before any of this code runs. If the package genuinely isn't installed,
 * Metro fails at bundle time regardless of the try/catch. (This is a real
 * constraint we hit while building this: an earlier draft of this file
 * described the dependency as "optional," which was wrong -- see README
 * "Deviations from the spec" for the corrected framing.)
 *
 * We picked `react-native-sound` over `expo-av`/`expo-audio` because it
 * works in a bare RN app without requiring Expo modules/config plugins --
 * pulling in `expo-modules-core` is a much bigger ask for partner apps that
 * aren't already on Expo. Host apps that ARE on Expo can swap this adapter
 * for one backed by `expo-av`/`expo-audio`; the rest of the SDK only depends
 * on the tiny `play`/`stop` surface below.
 */
export interface AudioPlayerAdapter {
  play(url: string): Promise<void>;
  stop(): void;
}

type SoundModule = {
  new (
    url: string,
    basePath: undefined,
    onLoad: (error: unknown) => void
  ): {
    play(onEnd?: (success: boolean) => void): void;
    release(): void;
  };
};

class ReactNativeSoundAdapter implements AudioPlayerAdapter {
  private activeSound: { release(): void } | null = null;

  async play(url: string): Promise<void> {
    let SoundCtor: SoundModule;
    try {
      // Lazy require: don't pay for/crash on this dependency unless voice
      // guidance is actually used and the peer dependency is installed.

      const mod = require('react-native-sound');
      SoundCtor = (mod?.default ?? mod) as SoundModule;
    } catch (error) {
      logger.warn(
        '"react-native-sound" is not installed -- skipping voice guidance playback. ' +
          'Install it as a peer dependency to enable audio (see README).',
        error
      );
      return;
    }

    this.stop();

    return new Promise<void>((resolve) => {
      const sound = new SoundCtor(url, undefined, (error) => {
        if (error) {
          logger.warn('Failed to load voice guidance audio.', error);
          resolve();
          return;
        }
        this.activeSound = sound;
        sound.play(() => {
          sound.release();
          if (this.activeSound === sound) this.activeSound = null;
          resolve();
        });
      });
    });
  }

  stop(): void {
    if (this.activeSound) {
      try {
        this.activeSound.release();
      } catch {
        // fail-safe: releasing a player must never throw upward
      }
      this.activeSound = null;
    }
  }
}

export const audioPlayer: AudioPlayerAdapter = new ReactNativeSoundAdapter();
