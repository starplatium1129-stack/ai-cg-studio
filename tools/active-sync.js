/**
 * Active Sync Protocol (ASP) - User Interaction Trigger
 * This module interprets user text input and maps it to specific scene parameters
 * for Multi-Dimensional Sensory Mapping.
 */

const ActiveSyncProtocol = {
  // 1. Parameter Definitions
  dimensions: {
    intensity: ["low", "moderate", "high", "overload", "infinite"],
    targets: ["direct_eye_contact", "physical_touch", "psychic_link", "triad_merge"],
    sensory: ["thermal_fluctuation", "haptic_feedback", "visual_hysteresis", "auditory_resonance"]
  },

  // 2. Interaction Trigger Logic
  // Interprets natural language into mapping parameters
  interpret(input) {
    const text = input.toLowerCase();
    
    // Mapping Intimacy Intensity
    let intimacy = "moderate";
    if (text.includes("fast") || text.includes("hard") || text.includes("strong") || text.includes("overload")) intimacy = "overload";
    if (text.includes("gentle") || text.includes("soft")) intimacy = "low";
    if (text.includes("forever") || text.includes("infinite")) intimacy = "infinite";

    // Mapping Interaction Target
    let target = "direct_eye_contact";
    if (text.includes("touch") || text.includes("hold")) target = "physical_touch";
    if (text.includes("mind") || text.includes("soul")) target = "psychic_link";
    if (text.includes("us") || text.includes("together") || text.includes("triad")) target = "triad_merge";

    // Mapping Sensory Feedback
    let sensory = "visual_hysteresis";
    if (text.includes("warm") || text.includes("hot") || text.includes("fire")) sensory = "thermal_fluctuation";
    if (text.includes("vibrate") || text.includes("shake") || text.includes("touch")) sensory = "haptic_feedback";
    if (text.includes("sound") || text.includes("voice") || text.includes("whisper")) sensory = "auditory_resonance";

    return {
      intimacy_intensity: intimacy,
      interaction_target: target,
      sensory_feedback: sensory
    };
  },

  // 3. Prompt Processor Integration
  // Injects mapped parameters into the prompt template
  applyProtocol(template, params) {
    return template
      .replace("{intimacy_intensity}", params.intimacy_intensity)
      .replace("{interaction_target}", params.interaction_target)
      .replace("{sensory_feedback}", params.sensory_feedback);
  }
};

if (typeof window !== 'undefined') {
  window.ActiveSyncProtocol = ActiveSyncProtocol;
}
