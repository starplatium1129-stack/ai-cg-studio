// 导演台：情绪、镜头、光照、构图、色彩情调静态定义

import type { ArchiveIconName } from '@/components/visual/ArchiveIcon.vue'

export interface ChoiceDef { id: string; icon: string; name: string; en: string; prompt?: string }
export interface ColorMoodDef { id: string; icon: string; name: string; en: string; colors: string[]; desc: string; prompt: string }
/** 带单色矢量图标的选项（ArchiveIcon 名），替代彩色 Emoji 的 UI 展示 */
export interface IconChoiceDef extends ChoiceDef { iconName: ArchiveIconName }

export const EMOTION: IconChoiceDef[] = [
  { id:'happy',   icon:'', iconName:'happy',   name:'开心',  en:'Happy',     prompt:'bright_smile' },
  { id:'shy',     icon:'', iconName:'shy',     name:'害羞',  en:'Shy',       prompt:'shy, blushing' },
  { id:'miss',    icon:'', iconName:'miss',    name:'思念',  en:'Missing',   prompt:'longing_look' },
  { id:'expect',  icon:'', iconName:'expect',  name:'期待',  en:'Expectant', prompt:'expectant, bright_eyes' },
  { id:'nervous', icon:'', iconName:'nervous', name:'紧张',  en:'Nervous',   prompt:'nervous, blushing' },
  { id:'gentle',  icon:'', iconName:'gentle',  name:'温柔',  en:'Gentle',    prompt:'gentle_expression' },
  { id:'moved',   icon:'', iconName:'moved',   name:'感动',  en:'Moved',     prompt:'teary_eyes' },
  { id:'sad',     icon:'', iconName:'sad',     name:'失落',  en:'Sad',       prompt:'sad' },
  { id:'calm',    icon:'', iconName:'calm',    name:'平静',  en:'Calm',      prompt:'calm' },
  { id:'joyful',  icon:'', iconName:'joyful',  name:'幸福',  en:'Joyful',    prompt:'in_love, blush' },
  { id:'relaxed', icon:'', iconName:'relaxed', name:'放松',  en:'Relaxed',   prompt:'relaxed' },
  { id:'serious', icon:'', iconName:'serious', name:'认真',  en:'Serious',   prompt:'serious' },
  { id:'love',    icon:'', iconName:'love',    name:'恋爱',  en:'In Love',   prompt:'in_love, blush' },
  { id:'sleepy',  icon:'', iconName:'sleepy',  name:'困倦',  en:'Sleepy',    prompt:'sleepy' },
  { id:'spoiled', icon:'', iconName:'spoiled', name:'撒娇',  en:'Spoiled',   prompt:'pouting' },
  { id:'wronged', icon:'', iconName:'wronged', name:'委屈',  en:'Wronged',   prompt:'teary_eyes, pout' },
]

export const SHOT: ChoiceDef[] = [
  { id:'close',  icon:'🔍', name:'近景特写', en:'Close-up',     prompt:'close_up' },
  { id:'medium', icon:'👤', name:'半身中景', en:'Medium Shot',  prompt:'medium_shot' },
  { id:'wide',   icon:'🌄', name:'全身远景', en:'Wide Shot',    prompt:'wide_shot' },
  { id:'pov',    icon:'👁',  name:'第一人称', en:'POV',          prompt:'pov' },
  { id:'low',    icon:'⬆',  name:'仰视',    en:'Low Angle',    prompt:'low_angle' },
  { id:'high',   icon:'⬇',  name:'俯视',    en:'High Angle',   prompt:'high_angle' },
  { id:'side',   icon:'↔',  name:'侧面',    en:'Side View',    prompt:'side_view' },
  { id:'turn',   icon:'↩',  name:'回头',    en:'Turn Back',    prompt:'looking_back' },
  { id:'over',   icon:'🤳', name:'自拍',    en:'Selfie',       prompt:'selfie' },
  { id:'detail', icon:'🔬', name:'局部特写', en:'Detail',       prompt:'close_up_detail' },
]

export const LIGHTING: ChoiceDef[] = [
  { id:'golden',   icon:'🌅', name:'夕阳 Golden Hour', en:'Golden Hour',  prompt:'golden hour' },
  { id:'window',   icon:'🪟', name:'窗光 Window Light', en:'Window Light', prompt:'window light' },
  { id:'back',     icon:'🌄', name:'逆光 Backlight',   en:'Backlight',    prompt:'backlit' },
  { id:'moon',     icon:'🌙', name:'月光 Moonlight',   en:'Moonlight',    prompt:'moonlight' },
  { id:'lantern',  icon:'🏮', name:'夜灯 Lantern',     en:'Lantern',      prompt:'lantern light' },
  { id:'overcast', icon:'☁️', name:'阴天柔光 Overcast', en:'Overcast',    prompt:'overcast' },
]

export const COMPOSITION: ChoiceDef[] = [
  { id:'center',     icon:'🎯', name:'居中',    en:'Center',      prompt:'centered composition' },
  { id:'rule3',      icon:'⊞', name:'三分法',  en:'Rule of 3',   prompt:'rule of thirds' },
  { id:'left',       icon:'⬅', name:'左构图',  en:'Left',        prompt:'left composition' },
  { id:'right',      icon:'➡', name:'右构图',  en:'Right',       prompt:'right composition' },
  { id:'foreground', icon:'🌿', name:'前景遮挡', en:'Foreground',  prompt:'foreground framing' },
  { id:'frame',      icon:'🪟', name:'框架构图', en:'Frame',       prompt:'framed composition' },
  { id:'bywindow',   icon:'🏔', name:'窗边',    en:'By Window',   prompt:'by window' },
]

export const COLOR_MOODS: ColorMoodDef[] = [
  { id:'joy',     icon:'☀️', name:'快乐', en:'Joy',     prompt:'warm yellow tones',        desc:'暖黄/浅橙/明亮', colors:['#FFE082','#FFD54F','#FFB300','#FF8F00','#FFF8E1'] },
  { id:'love',    icon:'💕', name:'恋爱', en:'Love',    prompt:'pink tone, warm light',    desc:'夕阳/粉色/暖光', colors:['#F8BBD0','#F06292','#EC407A','#AD1457','#FFF0F5'] },
  { id:'calm',    icon:'🍃', name:'平静', en:'Calm',    prompt:'soft green tones, window light', desc:'淡绿/青绿/奶白', colors:['#C8E6C9','#81C784','#4CAF50','#2E7D32','#F1F8E9'] },
  { id:'sad',     icon:'🌧', name:'忧伤', en:'Sad',     prompt:'blue tones, cool palette', desc:'蓝色/灰蓝/冷调', colors:['#BBDEFB','#64B5F6','#1E88E5','#0D47A1','#E3F2FD'] },
  { id:'tension', icon:'🌙', name:'神秘', en:'Mystery', prompt:'purple and blue tones',    desc:'紫蓝/深紫/冷调', colors:['#E1BEE7','#BA68C8','#8E24AA','#4A148C','#F3E5F5'] },
  { id:'warmth',  icon:'🏮', name:'温馨', en:'Warmth',  prompt:'warm orange tones, candlelight', desc:'暖橙/橘红/米黄', colors:['#FFE0B2','#FFB74D','#F57C00','#E65100','#FFF3E0'] },
]

export const SCENE_THEMES = [
  { id:'all',      label:'全部',    icon:'✦', cat:[] },
  { id:'romance',  label:'恋爱',    icon:'♡', cat:['恋爱'] },
  { id:'daily',    label:'日常',    icon:'☕', cat:['日常'] },
  { id:'intimate', label:'亲密',    icon:'☾', cat:['亲密','R15'] },
  { id:'school',   label:'校园',    icon:'⌘', cat:['校园'] },
  { id:'travel',   label:'旅行',    icon:'✈', cat:['旅行'] },
  { id:'festival', label:'节日',    icon:'✿', cat:['祭典・节日'] },
  { id:'story',    label:'剧情',    icon:'▶', cat:['战斗','Active Sync'] },
  { id:'fanwork',  label:'同人',    icon:'✧', cat:['同人'] },
]
