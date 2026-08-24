/**
 * 精致化场景与蓝图重构知识库：
 * 按照本次沉淀的最高审美宪章，对 174 个热门角色蓝图 + 157 个场景库进行深度艺术与逻辑重构。
 * 
 * 核心设计铁律：
 * 1. 动态与透视支撑：打破站桩，引入明确的躯干动势、三角形支撑力（支颐、斜倚、拔刀起手、腰部微弯）。
 * 2. 空间与道具层次：禁止孤立人物贴在黑白底上，必须构建【前景+中景主体+背景透视+地表倒影/落叶/水纹】。
 * 3. 角色灵魂特写：锁定标志性瞳孔（异色时钟眼、圈圈眼、发光瞳）、微表情（克制羞红、轻嘲挑逗、冷静专注）。
 * 4. 材质与物理交互：丝袜绝对单选（纯黑透肉/网袜严禁冲突并排死对侧），湿身/水汽必带水滴反光与贴发。
 */

module.exports = {
  // 通用解剖与材质增强词库
  ANATOMY_ENHANCEMENT: {
    lying: ['reclining_gracefully', 'natural_gravity_body_deformation', 'soft_mattress_indentation', 'arched_back', 'delicate_collarbone'],
    standing: ['dynamic_contrapposto_pose', 'weight_shifted_to_one_leg', 'natural_spine_curvature', 'flowing_hair_motion'],
    sitting: ['elegant_seated_posture', 'resting_chin_on_hand', 'crossed_legs', 'soft_thigh_compression'],
    combat: ['dynamic_fighting_stance', 'two-handed_weapon_grip', 'weight_settled_low', 'wind_vortex', 'billowing_clothes']
  },
  
  // 空间环境与光影地表补充
  ENVIRONMENT_GROUNDING: {
    night: ['atmospheric_depth', 'cool_moonlight_beam', 'warm_candlelight_contrast', 'floor_reflections', 'soft_ambient_shadows'],
    dusk: ['golden_hour_rim_light', 'volumetric_sunbeams', 'warm_orange_and_purple_sky', 'long_dramatic_shadows'],
    indoor: ['interior_depth', 'detailed_wooden_furniture', 'soft_curtain_shadows', 'warm_lamp_glow'],
    rain_water: ['wet_ground_reflections', 'puddle_ripples', 'splashing_droplets', 'glistening_water_streaks']
  }
};
