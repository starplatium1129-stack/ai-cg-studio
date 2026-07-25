export type CharacterId = string;
export type SceneCharacterId = CharacterId | 'triad';

export interface CharacterPortrait {
  image: string;
  alt: string;
}

export interface CharacterTrait {
  tag: string;
  label: string;
  icon?: string;
}

export interface CharacterProfile {
  id: CharacterId;
  name: string;
  alias: string[];
  source: string;
  speech: string;
  portrait: CharacterPortrait;
  visual_dna: { signature: string; [key: string]: string };
  traits: CharacterTrait[];
  lora: { name: string; weight: number; recommended_scene?: string[] };
}

export interface LoraProfile {
  id: string;
  name: string;
  version: string;
  trigger: string;
  character: string;
  strength: { default: number; min: number; max: number };
  compatible_models: string[];
  test_scene: string[];
}

export interface SceneRecord {
  id: string;
  char: SceneCharacterId;
  character: CharacterId[];
  title: string;
  story: string;
  prompt: string;
  negative: string;
  rating: 'All' | 'R15' | 'R18';
  [key: string]: unknown;
}

export type VoiceId = 'nene' | 'natsume';
export type VoiceLanguage = 'ja' | 'zh';
export type VoiceEmotion = 'neutral' | 'gentle' | 'happy' | 'shy' | 'serious' | 'sad';
export type VoiceConsistency = 'locked' | 'adaptive';

export interface VoiceEmotionReference {
  refAudioPath: string;
  promptText: string;
  promptLang?: string;
}

export interface VoiceProfile {
  refAudioPath: string;
  promptText: string;
  promptLang: string;
  textLang: string;
  gptWeightsPath: string;
  sovitsWeightsPath: string;
  seed: number;
  topK: number;
  topP: number;
  temperature: number;
  references?: Partial<Record<VoiceEmotion, VoiceEmotionReference>>;
}

export interface VoiceTtsInput {
  voice: VoiceId | string;
  text: string;
  language?: VoiceLanguage | string;
  emotion?: VoiceEmotion | string;
  referenceEmotion?: VoiceEmotion | string;
  consistency?: VoiceConsistency | string;
  speed?: number;
}
