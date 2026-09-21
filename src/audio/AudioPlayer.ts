import { logger } from '../safety/logger';

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
      } catch {}
      this.activeSound = null;
    }
  }
}

export const audioPlayer: AudioPlayerAdapter = new ReactNativeSoundAdapter();
