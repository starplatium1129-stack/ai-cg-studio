/**
 * Active Sync Protocol (ASP) - Weight-Based Parsing Engine
 * 正则单词边界（英文）+ 直接匹配（中文）+ 权重计分，避免 includes() 误匹配。
 * 三个维度：intensity（权重累加）/ targets（频次）/ sensory（频次）
 */

// 英文用 \b 边界，中文无边界直接匹配
function _rx(en, cn) {
  return new RegExp('\\b(' + en + ')\\b|(' + cn + ')', 'ig');
}

const ActiveSyncProtocol = {
  dimensions: {
    intensity: ["low", "moderate", "high", "overload", "infinite"],
    targets: ["direct_eye_contact", "physical_touch", "psychic_link", "triad_merge"],
    sensory: ["thermal_fluctuation", "haptic_feedback", "visual_hysteresis", "auditory_resonance"]
  },

  _dictionary: {
    intensity: {
      gentle:   { regex: _rx('gentle|soft|slow|calm|tender', '低语|呢喃|轻柔'), weight: -2 },
      normal:   { regex: _rx('normal|steady|usual', '平稳|平常'), weight: 0 },
      strong:   { regex: _rx('strong|fast|hard|intense|rough', '心跳|呼吸|心律|同步'), weight: 2 },
      extreme:  { regex: _rx('overload|forever|infinite', '感官过载|无限循环|极致|永恒'), weight: 4 }
    },
    targets: {
      eye:      { regex: _rx('eye|gaze|stare', '凝视|眼神|注视|对视'), value: "direct_eye_contact" },
      touch:    { regex: _rx('touch|hold|finger|skin|pulse|vibrate|shake', '指尖|触碰|接触|皮肤|脉搏'), value: "physical_touch" },
      mind:     { regex: _rx('mind|soul|link|psychic', '心灵|灵魂|感应|共鸣'), value: "psychic_link" },
      triad:    { regex: _rx('triad|merge|together|three', '融合|三位一体|三重'), value: "triad_merge" }
    },
    sensory: {
      thermal:  { regex: _rx('warm|hot|fire|heat|temperature', '体温|温度|温暖|灼热'), value: "thermal_fluctuation" },
      haptic:   { regex: _rx('vibrate|shake|touch|pulse', '触觉|触感|脉搏|心跳'), value: "haptic_feedback" },
      visual:   { regex: _rx('afterimage|glow|haze|blur', '残像|余晖|朦胧|光芒'), value: "visual_hysteresis" },
      auditory: { regex: _rx('sound|voice|whisper|echo', '声音|低语|回响|耳畔'), value: "auditory_resonance" }
    }
  },

  _parseIntensity(text) {
    if (!text) return "moderate";
    const dict = this._dictionary.intensity;
    let score = 0;
    for (const [, data] of Object.entries(dict)) {
      const matches = text.match(data.regex);
      if (matches) score += matches.length * data.weight;
    }
    if (score >= 10) return "infinite";
    if (score >= 7) return "overload";
    if (score >= 3) return "high";
    if (score <= -2) return "low";
    return "moderate";
  },

  _parseTargets(text) {
    if (!text) return "direct_eye_contact";
    const dict = this._dictionary.targets;
    let best = "direct_eye_contact", bestCount = 0;
    for (const [, data] of Object.entries(dict)) {
      const matches = text.match(data.regex);
      const count = matches ? matches.length : 0;
      if (count > bestCount) { bestCount = count; best = data.value; }
    }
    return best;
  },

  _parseSensory(text) {
    if (!text) return "visual_hysteresis";
    const dict = this._dictionary.sensory;
    let best = "visual_hysteresis", bestCount = 0;
    for (const [, data] of Object.entries(dict)) {
      const matches = text.match(data.regex);
      const count = matches ? matches.length : 0;
      if (count > bestCount) { bestCount = count; best = data.value; }
    }
    return best;
  },

  interpret(input) {
    const text = input || "";
    return {
      intimacy_intensity: this._parseIntensity(text),
      interaction_target: this._parseTargets(text),
      sensory_feedback: this._parseSensory(text)
    };
  },

  applyProtocol(template, params) {
    var processed = template
      .replace(/\{intimacy_intensity\}/g, params.intimacy_intensity)
      .replace(/\{interaction_target\}/g, params.interaction_target)
      .replace(/\{sensory_feedback\}/g, params.sensory_feedback);
    // 兜底：清除模板中未被识别的 {placeholder}，防止残留污染 Prompt
    return processed.replace(/\{[a-zA-Z0-9_]+\}/g, '');
  }
};

if (typeof window !== 'undefined') {
  window.ActiveSyncProtocol = ActiveSyncProtocol;
}
