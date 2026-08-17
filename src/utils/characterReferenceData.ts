export interface CharacterReferenceItem {
  id: string
  name: string
  shotType: string
  fileName: string
  lens: string
  targetUsage: string[]
  url: string
}

export interface CharacterOutfitReference {
  outfitId: string
  outfitName: string
  isDefault: boolean
  isNsfw: boolean
  prose: string
  references: CharacterReferenceItem[]
}

export interface CharacterReferenceProfile {
  characterId: string
  displayName: string
  source: string
  identityProse: string
  outfits: CharacterOutfitReference[]
}

export const CHARACTER_REFERENCE_STANDARDS: Record<string, CharacterReferenceProfile> = {
  "nene": {
    "characterId": "nene",
    "displayName": "绫地宁宁",
    "source": "YUZUSOFT《サノバウィッチ》",
    "identityProse": "Ayachi Nene, a gentle and beautiful girl with long silver hair tied in elegant low twintails, an expressive ahoge, delicate pink hair ribbons, deep violet eyes",
    "outfits": [
      {
        "outfitId": "witch_canonical",
        "outfitName": "经典魔女服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "wearing her signature black witch outfit with a pointed witch hat, black cape, criss-cross halter crop top with pink bow, black pleated skirt, and asymmetrical striped thigh-highs",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/nene/witch_canonical/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/nene/witch_canonical/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/nene/witch_canonical/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/nene/witch_canonical/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "school_uniform",
        "outfitName": "学院校服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "wearing her neat high school uniform with white collared shirt, navy blazer, school tie, and pleated navy skirt with black knee socks",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/nene/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/nene/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/nene/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/nene/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual_summer",
        "outfitName": "日常夏装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "wearing a comfortable casual light pastel summer dress with delicate floral accents and white flat shoes",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/nene/casual_summer/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/nene/casual_summer/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/nene/casual_summer/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/nene/casual_summer/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, medium breasts, pink nipples, slender waist, navel, bare legs and bare feet, intimate soft bedroom lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/nene/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/nene/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/nene/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/nene/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "natsume": {
    "characterId": "natsume",
    "displayName": "四季夏目",
    "source": "YUZUSOFT《喫茶ステラと死神の蝶》",
    "identityProse": "Shiki Natsume, a cool and refined young woman with silky long straight black hair, amber golden eyes, a subtle distinct mole under her left eye, side hairclip",
    "outfits": [
      {
        "outfitId": "cafe_uniform",
        "outfitName": "Café Stella 制服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "wearing the elegant Café Stella uniform with a crisp collared white shirt, neat necktie, dark work apron, tailored brown pleated skirt, and black thigh-highs",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/natsume/cafe_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/natsume/cafe_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/natsume/cafe_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/natsume/cafe_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual_knit",
        "outfitName": "秋冬针织私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "wearing a cozy oversized knit beige sweater, dark mini skirt, warm woolen scarf, and black tights",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/natsume/casual_knit/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/natsume/casual_knit/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/natsume/casual_knit/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/natsume/casual_knit/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural slender female body, delicate small breasts, pink nipples, mole under eye visible, slender waist, navel, bare legs, soft warm ambient lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/natsume/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/natsume/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/natsume/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/natsume/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "raiden_shogun": {
    "characterId": "raiden_shogun",
    "displayName": "雷电将军",
    "source": "Genshin Impact",
    "identityProse": "Raiden Shogun from Genshin Impact, also known as Raiden Ei, the Electro Archon, a serene and regal woman with long lavender hair in a braid, glowing violet eyes, and a calm expressionless gaze, wearing the Raiden Shogun's flowing purple Japanese robes, bare shoulders, thigh-highs and a long braid",
    "outfits": [
      {
        "outfitId": "shogun_robes",
        "outfitName": "将军神装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "the Raiden Shogun's flowing purple Japanese robes, bare shoulders, thigh-highs and a long braid with gold trim, pauldron, black fingerless gloves, obi, and sash",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/raiden_shogun/shogun_robes/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/raiden_shogun/shogun_robes/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/raiden_shogun/shogun_robes/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/raiden_shogun/shogun_robes/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "modern_clothes",
        "outfitName": "现代便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a refined modern purple dress and her signature long single braid",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/raiden_shogun/modern_clothes/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/raiden_shogun/modern_clothes/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/raiden_shogun/modern_clothes/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/raiden_shogun/modern_clothes/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/raiden_shogun/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/raiden_shogun/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/raiden_shogun/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/raiden_shogun/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "sakurajima_mai": {
    "characterId": "sakurajima_mai",
    "displayName": "樱岛麻衣",
    "source": "Rascal Does Not Dream of Bunny Girl Senpai",
    "identityProse": "Sakurajima Mai from Rascal Does Not Dream of Bunny Girl Senpai, an elegant actress with long straight silky black hair, soft purple-grey eyes, a delicate beauty mark beneath her left eye, and her iconic white rabbit-shaped hair clip pinned on the side of her hair, carrying a composed and alluring presence",
    "outfits": [
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "the Minegahara High School uniform with a brown blazer, beige knit sweater vest, red necktie, white collared shirt, grey pleated skirt and black pantyhose",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/sakurajima_mai/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/sakurajima_mai/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/sakurajima_mai/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/sakurajima_mai/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "bunny_girl",
        "outfitName": "兔女郎",
        "isDefault": false,
        "isNsfw": false,
        "prose": "the iconic black bunny suit with bunny ears, a black leotard, fishnet stockings and a bow tie",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/sakurajima_mai/bunny_girl/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/sakurajima_mai/bunny_girl/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/sakurajima_mai/bunny_girl/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/sakurajima_mai/bunny_girl/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "street_clothes",
        "outfitName": "私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a soft casual street outfit with a knit sweater and skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/sakurajima_mai/street_clothes/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/sakurajima_mai/street_clothes/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/sakurajima_mai/street_clothes/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/sakurajima_mai/street_clothes/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/sakurajima_mai/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/sakurajima_mai/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/sakurajima_mai/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/sakurajima_mai/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "tokisaki_kurumi": {
    "characterId": "tokisaki_kurumi",
    "displayName": "时崎狂三",
    "source": "Date A Live",
    "identityProse": "Tokisaki Kurumi from Date A Live, a mysterious girl with long dark hair in side twintails, two-tone red and gold eyes, and a pale elegant face, often dressed in black and crimson gothic attire",
    "outfits": [
      {
        "outfitId": "gothic_dress",
        "outfitName": "哥特洋装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her signature black and crimson gothic dress with frills and a high collar",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tokisaki_kurumi/gothic_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tokisaki_kurumi/gothic_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tokisaki_kurumi/gothic_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tokisaki_kurumi/gothic_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her dark school uniform with a sailor collar and pleated skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tokisaki_kurumi/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tokisaki_kurumi/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tokisaki_kurumi/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tokisaki_kurumi/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a casual black outfit with a choker and loose cardigan",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tokisaki_kurumi/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tokisaki_kurumi/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tokisaki_kurumi/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tokisaki_kurumi/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tokisaki_kurumi/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tokisaki_kurumi/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tokisaki_kurumi/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tokisaki_kurumi/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "frieren": {
    "characterId": "frieren",
    "displayName": "芙莉莲",
    "source": "Frieren: Beyond Journey's End",
    "identityProse": "Frieren from Frieren: Beyond Journey's End, a centuries-old elf mage with very long white hair in low twin braids, violet eyes and pointed ears, with a calm, wistful expression",
    "outfits": [
      {
        "outfitId": "wizard_robe",
        "outfitName": "魔导师袍",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her plain white robe with a deep hood and simple adventurer belt, staff in hand",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/frieren/wizard_robe/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/frieren/wizard_robe/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/frieren/wizard_robe/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/frieren/wizard_robe/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "travel_clothes",
        "outfitName": "旅行装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a practical traveler's cloak over simple clothes",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/frieren/travel_clothes/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/frieren/travel_clothes/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/frieren/travel_clothes/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/frieren/travel_clothes/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a soft casual dress she wears away from battle",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/frieren/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/frieren/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/frieren/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/frieren/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/frieren/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/frieren/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/frieren/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/frieren/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "artoria_pendragon": {
    "characterId": "artoria_pendragon",
    "displayName": "阿尔托莉雅",
    "source": "Fate",
    "identityProse": "Saber, Artoria Pendragon from Fate/stay night, a regal knight with blonde hair tied in an intricate braided bun, an ahoge, and clear emerald-green eyes, with an earnest, dignified bearing",
    "outfits": [
      {
        "outfitId": "knight_dress",
        "outfitName": "骑士裙装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her iconic blue armored dress with a white underdress, blue cuirass and long white gloves",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/artoria_pendragon/knight_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/artoria_pendragon/knight_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/artoria_pendragon/knight_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/artoria_pendragon/knight_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "卫宫家便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cozy dark blue knit cardigan over a crisp white collared shirt and skirt, her signature casual look from Today's Menu for the Emiya Family",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/artoria_pendragon/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/artoria_pendragon/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/artoria_pendragon/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/artoria_pendragon/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "formal_dress",
        "outfitName": "礼服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an elegant white formal dress with long sleeves and fine embroidery",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/artoria_pendragon/formal_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/artoria_pendragon/formal_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/artoria_pendragon/formal_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/artoria_pendragon/formal_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/artoria_pendragon/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/artoria_pendragon/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/artoria_pendragon/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/artoria_pendragon/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "hatsune_miku": {
    "characterId": "hatsune_miku",
    "displayName": "初音未来",
    "source": "VOCALOID",
    "identityProse": "Hatsune Miku, the VOCALOID virtual singer, a cheerful girl with iconic long teal twin-tails, bright turquoise eyes, black square hair ribbons, red 01 shoulder tattoo, and a vibrant stage presence",
    "outfits": [
      {
        "outfitId": "v2_classic",
        "outfitName": "V2 经典",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her classic sleeveless V2 outfit with a black necktie, short pleated skirt and white boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/hatsune_miku/v2_classic/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/hatsune_miku/v2_classic/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/hatsune_miku/v2_classic/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/hatsune_miku/v2_classic/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "stage",
        "outfitName": "舞台装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a sparkling concert stage outfit with light-up accents and flowing sleeves",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/hatsune_miku/stage/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/hatsune_miku/stage/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/hatsune_miku/stage/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/hatsune_miku/stage/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "street",
        "outfitName": "街头风",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a street-style casual outfit with a cropped jacket and sneakers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/hatsune_miku/street/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/hatsune_miku/street/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/hatsune_miku/street/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/hatsune_miku/street/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/hatsune_miku/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/hatsune_miku/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/hatsune_miku/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/hatsune_miku/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "yuzuriha_inori": {
    "characterId": "yuzuriha_inori",
    "displayName": "楪祈",
    "source": "Guilty Crown",
    "identityProse": "Yuzuriha Inori from Guilty Crown, a delicate singer with long pink and orange-gradient twin-tails, bright crimson eyes, red hair clips, and a fragile, ethereal presence",
    "outfits": [
      {
        "outfitId": "funeral_parade",
        "outfitName": "葬仪社装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "the white funeral parade combat outfit with a sleeveless top, black shorts, and a red ribbon",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yuzuriha_inori/funeral_parade/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yuzuriha_inori/funeral_parade/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yuzuriha_inori/funeral_parade/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yuzuriha_inori/funeral_parade/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her white and blue school uniform with a ribbon",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yuzuriha_inori/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yuzuriha_inori/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yuzuriha_inori/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yuzuriha_inori/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "red_dress",
        "outfitName": "红裙",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a striking red dress with a layered skirt and long sleeves",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yuzuriha_inori/red_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yuzuriha_inori/red_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yuzuriha_inori/red_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yuzuriha_inori/red_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yuzuriha_inori/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yuzuriha_inori/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yuzuriha_inori/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yuzuriha_inori/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "yukinoshita_yukino": {
    "characterId": "yukinoshita_yukino",
    "displayName": "雪之下雪乃",
    "source": "Oregairu",
    "identityProse": "Yukinoshita Yukino from Oregairu, a sharp and elegant young woman with long straight black hair, cool blue eyes, an ahoge, and neat red hair ribbons on her side locks",
    "outfits": [
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her neat navy school uniform with a ribbon and pleated skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yukinoshita_yukino/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yukinoshita_yukino/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yukinoshita_yukino/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yukinoshita_yukino/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a chic casual outfit with a white shirt and long coat",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yukinoshita_yukino/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yukinoshita_yukino/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yukinoshita_yukino/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yukinoshita_yukino/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "snow_dress",
        "outfitName": "雪夜礼服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a pure white dress like snow under winter lights",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yukinoshita_yukino/snow_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yukinoshita_yukino/snow_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yukinoshita_yukino/snow_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yukinoshita_yukino/snow_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/yukinoshita_yukino/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/yukinoshita_yukino/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/yukinoshita_yukino/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/yukinoshita_yukino/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "elaina": {
    "characterId": "elaina",
    "displayName": "伊雷娜",
    "source": "Wandering Witch",
    "identityProse": "Elaina from Wandering Witch: The Journey of Elaina, an inquisitive traveling witch with very long ash-gray hair, violet eyes, a black witch hat with gold buckle, with a confident smile",
    "outfits": [
      {
        "outfitId": "witch_dress",
        "outfitName": "魔女装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her black witch dress with a star brooch, frilled skirt and short staff",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/elaina/witch_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/elaina/witch_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/elaina/witch_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/elaina/witch_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "travel_clothes",
        "outfitName": "旅行装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a practical traveler's outfit with a long coat and boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/elaina/travel_clothes/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/elaina/travel_clothes/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/elaina/travel_clothes/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/elaina/travel_clothes/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a comfortable everyday dress in soft colors",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/elaina/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/elaina/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/elaina/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/elaina/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/elaina/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/elaina/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/elaina/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/elaina/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "misaka_mikoto": {
    "characterId": "misaka_mikoto",
    "displayName": "御坂美琴",
    "source": "A Certain Scientific Railgun",
    "identityProse": "Misaka Mikoto from A Certain Scientific Railgun, an energetic Tokiwadai student with short chestnut brown hair, warm brown eyes, white flower hair clip, and crackling blue-white electrical sparks",
    "outfits": [
      {
        "outfitId": "tokiwadai_uniform",
        "outfitName": "常盘台校服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her Tokiwadai uniform, a white blouse with a light-brown sweater vest and a beige pleated skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/misaka_mikoto/tokiwadai_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/misaka_mikoto/tokiwadai_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/misaka_mikoto/tokiwadai_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/misaka_mikoto/tokiwadai_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "summer_clothes",
        "outfitName": "夏季私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a light summer outfit with a thin top and shorts",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/misaka_mikoto/summer_clothes/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/misaka_mikoto/summer_clothes/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/misaka_mikoto/summer_clothes/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/misaka_mikoto/summer_clothes/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a casual outfit with a shirt and jeans",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/misaka_mikoto/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/misaka_mikoto/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/misaka_mikoto/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/misaka_mikoto/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/misaka_mikoto/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/misaka_mikoto/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/misaka_mikoto/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/misaka_mikoto/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "makima": {
    "characterId": "makima",
    "displayName": "玛奇玛",
    "source": "Chainsaw Man",
    "identityProse": "Makima from Chainsaw Man, a calm Public Safety leader with long salmon-pink hair braided into a low loose braid, golden concentric-ring eyes, and an unreadable, magnetic smile",
    "outfits": [
      {
        "outfitId": "work_suit",
        "outfitName": "公务套装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her office suit with a white blouse, black tie and black skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/makima/work_suit/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/makima/work_suit/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/makima/work_suit/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/makima/work_suit/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a relaxed casual outfit off the clock",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/makima/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/makima/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/makima/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/makima/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "overcoat",
        "outfitName": "风衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her long black overcoat with a high collar",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/makima/overcoat/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/makima/overcoat/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/makima/overcoat/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/makima/overcoat/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "devil_true_form",
        "outfitName": "支配恶魔真身",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her true form as the Control Devil: crimson hair in a single braid with golden concentric ring eyes and a menacing aura",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/makima/devil_true_form/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/makima/devil_true_form/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/makima/devil_true_form/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/makima/devil_true_form/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/makima/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/makima/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/makima/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/makima/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "tohsaka_rin": {
    "characterId": "tohsaka_rin",
    "displayName": "远坂凛",
    "source": "Fate/stay night",
    "identityProse": "Tohsaka Rin from Fate/stay night, a proud and brilliant mage with long dark-brown hair in twin-tails tied with large black ribbons, clear aqua-blue eyes, and a confident, spirited expression",
    "outfits": [
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her navy Homurahara school uniform with a ribbon",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tohsaka_rin/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tohsaka_rin/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tohsaka_rin/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tohsaka_rin/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "red_turtleneck",
        "outfitName": "红高领",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her casual red turtleneck with a black skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tohsaka_rin/red_turtleneck/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tohsaka_rin/red_turtleneck/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tohsaka_rin/red_turtleneck/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tohsaka_rin/red_turtleneck/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "mage_battle",
        "outfitName": "魔术战斗",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her mage combat outfit with glowing magic circuits and gems",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tohsaka_rin/mage_battle/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tohsaka_rin/mage_battle/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tohsaka_rin/mage_battle/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tohsaka_rin/mage_battle/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/tohsaka_rin/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/tohsaka_rin/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/tohsaka_rin/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/tohsaka_rin/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "rem_rezero": {
    "characterId": "rem_rezero",
    "displayName": "雷姆",
    "source": "Re:Zero",
    "identityProse": "Rem from Re:Zero, a devoted demon maid with short sky-blue hair parted over her right eye, one visible bright blue eye, a pink flower hair clip and white lace ribbon, and gentle features",
    "outfits": [
      {
        "outfitId": "maid_uniform",
        "outfitName": "女仆装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her classic black and white maid uniform with a frilled headdress and apron",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/rem_rezero/maid_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/rem_rezero/maid_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/rem_rezero/maid_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/rem_rezero/maid_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a soft casual outfit off duty",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/rem_rezero/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/rem_rezero/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/rem_rezero/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/rem_rezero/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "formal_dress",
        "outfitName": "礼服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an elegant formal dress for a special evening",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/rem_rezero/formal_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/rem_rezero/formal_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/rem_rezero/formal_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/rem_rezero/formal_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/rem_rezero/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/rem_rezero/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/rem_rezero/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/rem_rezero/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "emilia_rezero": {
    "characterId": "emilia_rezero",
    "displayName": "爱蜜莉雅",
    "source": "Re:Zero",
    "identityProse": "Emilia from Re:Zero, a gentle half-elf with long silver hair, pointed elven ears, purple-blue eyes with snowflake pupils, wearing a white flower hairpin and purple hair ribbons",
    "outfits": [
      {
        "outfitId": "white_dress",
        "outfitName": "白色连衣裙",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her signature white and lilac dress with a soft ribbon",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/emilia_rezero/white_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/emilia_rezero/white_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/emilia_rezero/white_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/emilia_rezero/white_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "witch_dress",
        "outfitName": "魔女装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dark witch-like dress worn in the capital",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/emilia_rezero/witch_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/emilia_rezero/witch_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/emilia_rezero/witch_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/emilia_rezero/witch_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a comfortable casual outfit",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/emilia_rezero/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/emilia_rezero/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/emilia_rezero/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/emilia_rezero/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/emilia_rezero/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/emilia_rezero/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/emilia_rezero/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/emilia_rezero/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "roxy_migurdia": {
    "characterId": "roxy_migurdia",
    "displayName": "洛琪希",
    "source": "Mushoku Tensei",
    "identityProse": "Roxy Migurdia from Mushoku Tensei, a Migurd magic teacher with long pale-blue hair tied into twin braids, blue eyes, a mole on her left collarbone",
    "outfits": [
      {
        "outfitId": "witch_outfit",
        "outfitName": "魔女服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her short witch outfit with a blue hat, white blouse and blue skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/roxy_migurdia/witch_outfit/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/roxy_migurdia/witch_outfit/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/roxy_migurdia/witch_outfit/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/roxy_migurdia/witch_outfit/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a relaxed casual dress in soft blue tones",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/roxy_migurdia/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/roxy_migurdia/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/roxy_migurdia/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/roxy_migurdia/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "adventurer",
        "outfitName": "冒险装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a practical adventurer outfit with a cape and boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/roxy_migurdia/adventurer/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/roxy_migurdia/adventurer/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/roxy_migurdia/adventurer/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/roxy_migurdia/adventurer/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/roxy_migurdia/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/roxy_migurdia/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/roxy_migurdia/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/roxy_migurdia/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "illyasviel_von_einzbern": {
    "characterId": "illyasviel_von_einzbern",
    "displayName": "伊莉雅丝菲尔",
    "source": "Fate/stay night",
    "identityProse": "Illyasviel von Einzbern from Fate/stay night, a petite homunculus girl with long snowy-white hair, bright ruby-red eyes, fine features, carrying an air of playful innocence and profound magic power",
    "outfits": [
      {
        "outfitId": "winter_coat",
        "outfitName": "Fate 本篇冬装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her red winter coat with a hood and fur trim from the Fuyuki winter story",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/winter_coat/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/winter_coat/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/winter_coat/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/winter_coat/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "white_dress",
        "outfitName": "白色连衣裙",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a pure white dress with a matching ribbon",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/white_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/white_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/white_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/white_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a soft casual outfit",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/illyasviel_von_einzbern/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "kitagawa_marin": {
    "characterId": "kitagawa_marin",
    "displayName": "喜多川海梦",
    "source": "My Dress-Up Darling",
    "identityProse": "Kitagawa Marin from My Dress-Up Darling, a glamorous and bubbly high school gyaru with long blonde hair with pink dip-dyed tips, bright dark-pink contact lenses, long painted nails and silver ear piercings",
    "outfits": [
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her school uniform with an open blazer and a loose tie",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kitagawa_marin/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kitagawa_marin/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kitagawa_marin/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kitagawa_marin/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "gal_casual",
        "outfitName": "日常辣妹",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a bright gyaru street outfit with a cropped top and skirt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kitagawa_marin/gal_casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kitagawa_marin/gal_casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kitagawa_marin/gal_casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kitagawa_marin/gal_casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cosplay",
        "outfitName": "泛用 cosplay",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a playful cosplay outfit with character accents and a wig",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kitagawa_marin/cosplay/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kitagawa_marin/cosplay/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kitagawa_marin/cosplay/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kitagawa_marin/cosplay/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "gothic_lolita",
        "outfitName": "哥特洛丽塔 cos",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her handmade gothic lolita cosplay with black frilled dress, lace and a hair bow",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kitagawa_marin/gothic_lolita/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kitagawa_marin/gothic_lolita/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kitagawa_marin/gothic_lolita/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kitagawa_marin/gothic_lolita/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kitagawa_marin/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kitagawa_marin/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kitagawa_marin/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kitagawa_marin/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "kisara_engage_kiss": {
    "characterId": "kisara_engage_kiss",
    "displayName": "木更",
    "source": "Engage Kiss",
    "identityProse": "Kisara from Engage Kiss, an A-class demon girl with very long pastel-pink hair, vibrant crimson eyes, an ahoge, center-parted bangs, a black hair ribbon, and an adhesive bandage on her right thigh",
    "outfits": [
      {
        "outfitId": "school_uniform",
        "outfitName": "校服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her school uniform with a white sailor collar, red bow, grey jacket with puffy sleeves, white pleated skirt and black kneehighs, with a bandage on her right thigh",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kisara_engage_kiss/school_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kisara_engage_kiss/school_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kisara_engage_kiss/school_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kisara_engage_kiss/school_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "demon_dress",
        "outfitName": "恶魔装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her demon outfit: a sleeveless black dress with a side slit, black thighhighs, a single black glove and a red bow",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kisara_engage_kiss/demon_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kisara_engage_kiss/demon_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kisara_engage_kiss/demon_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kisara_engage_kiss/demon_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "casual",
        "outfitName": "便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a modern casual outfit with a jacket and jeans",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kisara_engage_kiss/casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kisara_engage_kiss/casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kisara_engage_kiss/casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kisara_engage_kiss/casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kisara_engage_kiss/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kisara_engage_kiss/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kisara_engage_kiss/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kisara_engage_kiss/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "surtr_arknights": {
    "characterId": "surtr_arknights",
    "displayName": "史尔特尔",
    "source": "Arknights",
    "identityProse": "Surtr from Arknights, a lone Sarkaz swordswoman with wine-red long hair in a side low ponytail with a black headband, amber-orange eyes, black-red curved horns, wearing a black sleeveless cropped turtleneck with a black-and-white techwear jacket, black high-waisted shorts and thigh straps, carrying the giant molten greatsword Laevateinn",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "罗德岛作战服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her black sleeveless cropped turtleneck with a black-and-white techwear jacket with red lining, black high-waisted shorts, thigh holster, asymmetrical black thigh-high socks, combat boots, fingerless gloves and a black headband",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "colorful_wonderland",
        "outfitName": "缤纷奇境（泳装）",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a black and white two-piece bikini with a translucent black beach cover-up, sunglasses and a giant multi-scoop ice cream cone",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/colorful_wonderland/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/colorful_wonderland/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/colorful_wonderland/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/colorful_wonderland/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "liberte_echec",
        "outfitName": "自由//失效（街头滑板）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black off-shoulder top with a black and red plaid pleated skirt, a loose black jacket worn off her shoulders, a tiny golden crown hair accessory and a skateboard",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/liberte_echec/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/liberte_echec/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/liberte_echec/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/liberte_echec/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "prelude_to_transcendence",
        "outfitName": "超然序曲（音律礼服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black and gold gothic rock tailcoat jacket with gold epaulets and chains over a black lace shirt, tight leather pants and high heel boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/prelude_to_transcendence/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/prelude_to_transcendence/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/prelude_to_transcendence/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/prelude_to_transcendence/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "ice_cream_cafe_casual",
        "outfitName": "香草融意甜品店日常便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a sweet-cool street casual outfit: a loose oatmeal-grey cropped hoodie worn open over a tight black camisole, high-waisted charcoal pleated skirt with a metal-buckle belt, mismatched grey thigh-high socks and retro black-and-white chunky skate sneakers, small black crossbody bag",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/ice_cream_cafe_casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/ice_cream_cafe_casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/ice_cream_cafe_casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/ice_cream_cafe_casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "lava_silk_loungewear",
        "outfitName": "熔温夜曲丝绸慵懒睡袍",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a luxurious silk loungewear set: a short black silk slip nightdress with champagne-pink trim and delicate black lace trim at the chest and hem, overlaid with a sheer translucent black silk robe slipping off one shoulder, barefoot",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/lava_silk_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/lava_silk_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/lava_silk_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/lava_silk_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "crimson_velvet_evening_gown",
        "outfitName": "深红曜影高定露背晚礼服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dark haute couture evening gown: a wine-red to ink-black gradient heavy velvet fitted long dress with a deep V-neck and open back, high side slit, subtle gold embroidery lining the hem, black choker necklace, elbow-length sheer black lace gloves, hair in a low French bun",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/crimson_velvet_evening_gown/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/crimson_velvet_evening_gown/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/crimson_velvet_evening_gown/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/crimson_velvet_evening_gown/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/surtr_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/surtr_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/surtr_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/surtr_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "kaltsit_arknights": {
    "characterId": "kaltsit_arknights",
    "displayName": "凯尔希",
    "source": "Arknights",
    "identityProse": "Kal'tsit from Arknights, the stern Chief Medical Officer of Rhodes Island with pale mint-green short hair and twin side braids, lynx ears with black tufts, emerald green eyes, emerald crystal drop earrings, wearing a white lab coat over a black halterneck backless dress with a green utility belt and emerald earrings",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "罗德岛医师服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her white lab coat with pale green trim and a translucent hem over a black halterneck backless dress, a green tech utility belt and long emerald crystal drop earrings",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "evening_gown",
        "outfitName": "不觅浪尘（音律礼服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an elegant black velvet evening gown with gold and emerald embroidery, her hair up, holding a black cello",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/evening_gown/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/evening_gown/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/evening_gown/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/evening_gown/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "remains",
        "outfitName": "残余（决战常服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dark grey tactical cropped jacket over a black work vest, cargo pants and military boots, her hair in a side ponytail",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/remains/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/remains/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/remains/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/remains/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "walker",
        "outfitName": "遗尘漫步（学者行装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a grey-green hooded scholar cloak over a long robe, a brass astrolabe at her waist and a scholar staff",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/walker/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/walker/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/walker/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/walker/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "rhodes_island_lounge_knit",
        "outfitName": "罗德岛日常慵懒高领毛衣便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cozy lounge outfit: an oatmeal chunky-knit oversized turtleneck sweater with a relaxed dropped shoulder, over a sleeveless cotton camisole, paired with deep emerald wide-leg linen lounge trousers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/rhodes_island_lounge_knit/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/rhodes_island_lounge_knit/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/rhodes_island_lounge_knit/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/rhodes_island_lounge_knit/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "midnight_emerald_silk_robe",
        "outfitName": "深夜研读·墨绿真丝睡袍与吊带裙",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a deep emerald green silk dressing gown with subtle gold thread woven into the lapels, tied with a matching silk sash, worn over a simple black satin slip nightdress with a deep V back",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/midnight_emerald_silk_robe/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/midnight_emerald_silk_robe/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/midnight_emerald_silk_robe/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/midnight_emerald_silk_robe/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "victorian_traveler_coat",
        "outfitName": "维多利亚博物学者古典旅行大衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a forest-green heavyweight wool greatcoat with dark brown velvet lapels and a detachable shoulder capelet, worn over a ruffled white stand-collar blouse with a burgundy satin ribbon tie",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/victorian_traveler_coat/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/victorian_traveler_coat/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/victorian_traveler_coat/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/victorian_traveler_coat/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/kaltsit_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/kaltsit_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/kaltsit_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/kaltsit_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "chen_arknights": {
    "characterId": "chen_arknights",
    "displayName": "陈",
    "source": "Arknights",
    "identityProse": "Ch'en from Arknights, a Lungmen Guard Department officer with dark teal-blue hair in low twintails tied with red cords, amber-gold eyes, red-brown branching dragon horns, a long teal dragon tail, wearing a blue-and-black stand-collar tactical jacket over a white shirt with a black tie and a black pleated skirt, carrying the crimson-sheathed sword Chi Xiao",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "龙门近卫局制服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her blue-and-black short-sleeve stand-collar tactical jacket over a white shirt with a black tie, a black pleated skirt, knee-high socks and combat boots, twin swords at her back",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "ageless_afterglow",
        "outfitName": "岁红霞（旗袍）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a high-slit dark green and crimson qipao with gold dragon embroidery, a translucent green capelet, black pantyhose and high heels",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/ageless_afterglow/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/ageless_afterglow/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/ageless_afterglow/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/ageless_afterglow/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "holungday",
        "outfitName": "假日威龙（海滩装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a white crop halter top with light blue denim shorts, a red shirt tied at her waist, sunglasses and a high-pressure water gun",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/holungday/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/holungday/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/holungday/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/holungday/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "wanderer",
        "outfitName": "赤刃明霄（游侠行装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dark green and crimson traveller robe with a grey cape, a jade belt pendant, holding the crimson sword Chi Xiao",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/wanderer/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/wanderer/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/wanderer/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/wanderer/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "street_gourmet_casual",
        "outfitName": "龙门夜市街头休闲装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a retro 90s Hong Kong street-style casual outfit: an open vintage floral-print shirt over a plain white tee, slim washed dark jeans, white canvas sneakers, and a small black crossbody sling bag",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/street_gourmet_casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/street_gourmet_casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/street_gourmet_casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/street_gourmet_casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "morning_kendo_robe",
        "outfitName": "清晨道场练功服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a minimalist modern wushu training outfit: a loose white martial-arts gi jacket with dark teal accents, paired with dark teal wide-leg pleated hakama pants and a cloth obi belt",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/morning_kendo_robe/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/morning_kendo_robe/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/morning_kendo_robe/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/morning_kendo_robe/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "lgd_detective_undercover",
        "outfitName": "近卫局便衣潜伏风衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a classic hard-boiled detective undercover outfit: a dark charcoal trench coat over a black turtleneck and slim trousers, with polished black oxford leather shoes",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/lgd_detective_undercover/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/lgd_detective_undercover/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/lgd_detective_undercover/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/lgd_detective_undercover/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/chen_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/chen_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/chen_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/chen_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "eyjafjalla_arknights": {
    "characterId": "eyjafjalla_arknights",
    "displayName": "艾雅法拉",
    "source": "Arknights",
    "identityProse": "Eyjafjalla from Arknights, a Cautus volcano researcher with light ash-brown wavy hair in low twintails, small warm brown ram horns, ruby red eyes, wearing a dark grey hooded research coat over a white frilled blouse and black pleated skirt with black thighhighs",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "研究员裙装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her dark grey hooded volcano research coat over a white frilled blouse with a black pleated skirt, black thighhighs and black boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "summer_flower",
        "outfitName": "夏卉（泳装）",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a pink and white bikini with a straw sun hat and a swimming ring shaped like a small lamb",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/summer_flower/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/summer_flower/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/summer_flower/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/summer_flower/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "picnic",
        "outfitName": "远行前的野餐",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a retro dark green and cream country dress with a wool shawl, a beret and a picnic basket",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/picnic/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/picnic/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/picnic/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/picnic/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cozy_sheep_fleece_loungewear",
        "outfitName": "【温软梦乡】羊羔绒暖绒居家睡衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a fluffy oversized cream-and-tan sherpa fleece hoodie cardigan with a hood, worn like a cozy loungewear set with sheep pajamas, soft warm winter lounge look",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/cozy_sheep_fleece_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/cozy_sheep_fleece_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/cozy_sheep_fleece_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/cozy_sheep_fleece_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "siesta_hotspring_yukata",
        "outfitName": "【汐斯塔之憩】地热温泉和风浴衣",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a traditional Japanese onsen yukata with a pale floral pattern, light cotton fabric, tied with an obi sash, summer resort hot-spring robe",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/siesta_hotspring_yukata/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "leithanien_volcanology_lab_coat",
        "outfitName": "【学者之思】莱塔尼亚地质研究白大褂",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an intellectual volcanologist outfit: a white lab coat over a soft knit sweater and skirt, gold half-rim reading glasses, and a tiny silver hearing aid at the ear",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/leithanien_volcanology_lab_coat/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/leithanien_volcanology_lab_coat/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/leithanien_volcanology_lab_coat/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/leithanien_volcanology_lab_coat/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eyjafjalla_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eyjafjalla_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eyjafjalla_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eyjafjalla_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "lemuen_arknights": {
    "characterId": "lemuen_arknights",
    "displayName": "蕾缪安",
    "source": "Arknights",
    "identityProse": "Lemuen from Arknights, a Laterano Sankta advisor with warm ginger-brown wavy hair with a side braid, amber-gold eyes, a floating golden halo and small translucent wings at her lower back, wearing a slate dark tailored overcoat over a white collared shirt with a black necktie, seated in her high-tech wheelchair",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "拉特兰制服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her slate dark tailored long overcoat with a white collared shirt, a black necktie, dark trousers and a warm lap blanket, seated in her high-tech wheelchair",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/lemuen_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/lemuen_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/lemuen_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/lemuen_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "twilight_requiem",
        "outfitName": "暮星安魂曲（礼服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black and deep-blue starlit evening gown with a classical instrument-style wheelchair and a case-shaped rifle",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/lemuen_arknights/twilight_requiem/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/lemuen_arknights/twilight_requiem/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/lemuen_arknights/twilight_requiem/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/lemuen_arknights/twilight_requiem/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "baking_apron_loungewear",
        "outfitName": "苹果派烘焙日恬静甜点师便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cozy home baking outfit: a cream ribbed knit turtleneck sweater with the sleeves rolled to mid-arm, over a beige linen baking apron with a small apple emblem and big front pockets",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/lemuen_arknights/baking_apron_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/lemuen_arknights/baking_apron_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/lemuen_arknights/baking_apron_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/lemuen_arknights/baking_apron_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "rehab_cozy_knitwear",
        "outfitName": "温室休养录罗德岛医疗康复针织便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a soft recovery lounge outfit: an oversized chunky sage-green cable-knit cardigan over a champagne silk camisole, paired with flowing lounge trousers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/lemuen_arknights/rehab_cozy_knitwear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/lemuen_arknights/rehab_cozy_knitwear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/lemuen_arknights/rehab_cozy_knitwear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/lemuen_arknights/rehab_cozy_knitwear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "silk_lace_morning_robe",
        "outfitName": "午后私语真丝蕾丝晨袍与私密居家长裙",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a delicate morning loungewear set: a pearl-white silk slip nightdress with fine French lace trim at the neckline and hem, overlaid with a sheer champagne chiffon lace morning robe",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/lemuen_arknights/silk_lace_morning_robe/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/lemuen_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/lemuen_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/lemuen_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/lemuen_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "dusk_arknights": {
    "characterId": "dusk_arknights",
    "displayName": "夕",
    "source": "Arknights",
    "identityProse": "Dusk from Arknights, a reclusive painter among the Sui siblings, with very long black hair fading to teal-green ink gradient, teal-green eyes with red eyeshadow, teal jade dragon horns and a long ink-wash dragon tail, wearing an ink-black high-slit qipao with a sheer black-and-white gradient wide-sleeve robe, barefoot",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "水墨旗袍",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her ink-black high-slit qipao with dark teal cloud motifs, overlaid with a sheer black-and-white gradient wide-sleeve robe, barefoot",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/dusk_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/dusk_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/dusk_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/dusk_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "dying_dust",
        "outfitName": "染尘烟（新春旗袍）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black and gold high-slit short qipao with a black fur-trimmed capelet, black pantyhose, black heels and a long thin smoking pipe",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/dusk_arknights/dying_dust/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/dusk_arknights/dying_dust/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/dusk_arknights/dying_dust/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/dusk_arknights/dying_dust/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "atelier_slouchy_loungewear",
        "outfitName": "画斋幽梦",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an oversized slouchy ink-grey hoodie printed with a cute hand-drawn ink spirit mascot and splatter calligraphy, loose cotton loungewear shorts, messy hair bun held with a calligraphy brush, paint smudges on sleeves",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/dusk_arknights/atelier_slouchy_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/dusk_arknights/atelier_slouchy_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/dusk_arknights/atelier_slouchy_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/dusk_arknights/atelier_slouchy_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "ink_silk_nightdress",
        "outfitName": "墨染云纱",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a luxurious emerald-and-pearl-white gradient silk slip nightdress with fine black ink-flower lace at the V neckline and a high side slit, overlaid with a sheer gossamer wide-sleeved robe trailing like mist",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/dusk_arknights/ink_silk_nightdress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/dusk_arknights/ink_silk_nightdress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/dusk_arknights/ink_silk_nightdress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/dusk_arknights/ink_silk_nightdress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "neo_cyber_ink_techwear",
        "outfitName": "街头墨客",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a deconstructed ink-techwear outfit: a black strappy high-neck crop tank top, a lightweight techwear hooded jacket with cyan reflective lines and ink-splatter print worn loose off one shoulder, high-waisted black utility cargo pants with magnetic straps, chunky high-top sneakers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/dusk_arknights/neo_cyber_ink_techwear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/dusk_arknights/neo_cyber_ink_techwear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/dusk_arknights/neo_cyber_ink_techwear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/dusk_arknights/neo_cyber_ink_techwear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/dusk_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/dusk_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/dusk_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/dusk_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "mudrock_arknights": {
    "characterId": "mudrock_arknights",
    "displayName": "泥岩",
    "source": "Arknights",
    "identityProse": "Mudrock from Arknights, a gentle Sarkaz warrior with long silver-white hair, crimson eyes, curved black horns, wearing heavy olive-green power armor with a sealed helmet, and beneath it a dark high-neck bodysuit, carrying a huge engineering warhammer",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "重型装甲（战斗态）",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her heavy olive-green sealed power armor with a hazmat helmet and a huge engineering warhammer",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "elite2",
        "outfitName": "卸甲破壳态（连体服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her black high-neck bodysuit with heavy armor plates removed and set aside beside her, only a few shoulder pauldrons and forearm gauntlets still worn, long silver-white hair loose and her black Sarkaz horns visible",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/elite2/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/elite2/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/elite2/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/elite2/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "gravel",
        "outfitName": "砾瓦（日常工装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dark grey high-neck bodysuit under a relaxed beige work jacket with an open collar and a red scarf, comfortable cargo trousers and sturdy boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/gravel/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/gravel/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/gravel/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/gravel/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "silent_night",
        "outfitName": "静谧午夜（泳装）",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a black bikini with a translucent black beach cover-up, a small yellow frangipani flower on her horn and a parasol hammer",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/silent_night/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/silent_night/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/silent_night/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/silent_night/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "obsidian",
        "outfitName": "黑曜石（晚礼服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black off-shoulder evening gown with black lace trim, a deep red ruby brooch and obsidian feather ornaments, black high heels, gold chains on her horns",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/obsidian/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/obsidian/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/obsidian/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/obsidian/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "clay_artisan_apron",
        "outfitName": "陶艺工坊泥塑工装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a pottery artisan outfit: a breathable ivory linen long-sleeve shirt with sleeves rolled to the elbows, over a dark khaki canvas work apron with leather pockets holding wooden carving tools, clay smudges on the apron and fingertips, loose comfortable trousers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/clay_artisan_apron/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/clay_artisan_apron/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/clay_artisan_apron/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/clay_artisan_apron/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "rhodes_oversized_hoodie",
        "outfitName": "罗德岛大号连帽卫衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a super oversized charcoal-grey Rhodes Island hoodie reaching mid-thigh with sleeves past the fingertips, subtle geometric logo on the chest, black athletic shorts hidden under the hem",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/rhodes_oversized_hoodie/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/rhodes_oversized_hoodie/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/rhodes_oversized_hoodie/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/rhodes_oversized_hoodie/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cozy_winter_knit_coat",
        "outfitName": "暖冬高领粗针织毛衣与羊绒大衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an elegant winter outfit: a thick ivory chunky cable-knit turtleneck sweater, worn under an open dark camel long wool coat, with a soft cashmere scarf",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/cozy_winter_knit_coat/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/cozy_winter_knit_coat/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/cozy_winter_knit_coat/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/cozy_winter_knit_coat/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/mudrock_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/mudrock_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/mudrock_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/mudrock_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "eunectes_arknights": {
    "characterId": "eunectes_arknights",
    "displayName": "森蚺",
    "source": "Arknights",
    "identityProse": "Eunectes from Arknights, a cheerful Sarkaz mechanic with long dark green hair, golden slit-pupil eyes, a massive dark green anaconda snake tail, wearing a dark green halter crop top with a sleeveless tactical vest, leather hotpants and a single thigh-high sock with a leg harness",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "机械师工装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her dark green halter crop top with a grey-green sleeveless tactical vest, leather hotpants, a single thigh-high sock with a leg harness and heavy work boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eunectes_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eunectes_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eunectes_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eunectes_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "forgemaster",
        "outfitName": "熔锻铸匠（工装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black fire-resistant top with rolled-down coveralls tied at her waist, heat-resistant gloves and a heavy forging hammer",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eunectes_arknights/forgemaster/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eunectes_arknights/forgemaster/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eunectes_arknights/forgemaster/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eunectes_arknights/forgemaster/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "slumber_blueprint_loungewear",
        "outfitName": "蓝图微憩 / 工坊夜间休闲居家服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a relaxed cozy oversized loungewear: a slouchy off-shoulder oversized light-grey hoodie slipping to one side to reveal the collarbone and a black thin-strap camisole, black lounge shorts, knit leg warmers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eunectes_arknights/slumber_blueprint_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eunectes_arknights/slumber_blueprint_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eunectes_arknights/slumber_blueprint_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eunectes_arknights/slumber_blueprint_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "rainforest_safari_explorer",
        "outfitName": "林间搜猎 / 阿卡胡拉丛林勘探轻装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a rainforest safari utility outfit: an olive sports bralette under an open khaki short-sleeve utility shirt, quick-release climbing harness with metal carabiners at the waist, rugged cargo pants, explorer boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eunectes_arknights/rainforest_safari_explorer/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eunectes_arknights/rainforest_safari_explorer/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eunectes_arknights/rainforest_safari_explorer/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eunectes_arknights/rainforest_safari_explorer/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "gala_night_evening_dress",
        "outfitName": "盛宴夜影 / 庆典之夜",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a luxury high-slit evening gown in deep emerald green and satin black panels, asymmetrical one-shoulder neckline with an ornate metal clasp and pendant chain",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eunectes_arknights/gala_night_evening_dress/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eunectes_arknights/gala_night_evening_dress/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eunectes_arknights/gala_night_evening_dress/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eunectes_arknights/gala_night_evening_dress/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/eunectes_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/eunectes_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/eunectes_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/eunectes_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "goldenglow_arknights": {
    "characterId": "goldenglow_arknights",
    "displayName": "澄闪",
    "source": "Arknights",
    "identityProse": "Goldenglow from Arknights, a gentle Victorian apprentice hairdresser with long pale pink hair in low twintails, teal-blue eyes, pink folded cat ears and a fluffy pink cat tail, wearing a white shirt with a yellow ascot scarf, a dark suspender pinafore dress and a pleated skirt",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "理发师学徒工装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "a white shirt with a yellow ascot scarf, a dark suspender pinafore dress, a black pleated skirt, asymmetric thighhighs and a hairdresser tool pouch with scissors",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "maiden_of_night",
        "outfitName": "喜夜侍者（女仆装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black and white Victorian gothic maid dress with lace frills and a maid headband, holding a silver serving tray",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/maiden_of_night/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/maiden_of_night/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/maiden_of_night/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/maiden_of_night/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "greenhouse_tea",
        "outfitName": "花房茶话会（三丽鸥联动）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cream pink and mint lolita tea dress with frills, pink ribbon hairbows and Mary Jane shoes, in a greenhouse tea party setting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/greenhouse_tea/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/greenhouse_tea/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/greenhouse_tea/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/greenhouse_tea/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cozy_afternoon_knit_casual",
        "outfitName": "温暖午后·针织毛衣便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cozy autumn casual knit outfit: an oversized soft pink knit sweater with cream cable patterns, pink twintails peeking from a dark brown wool beret, folded pink cat ears visible, paired with a pleated skirt and tights",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/cozy_afternoon_knit_casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/cozy_afternoon_knit_casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/cozy_afternoon_knit_casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/cozy_afternoon_knit_casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "static_paw_cozy_cat_pajamas",
        "outfitName": "静电防线·小猫绒绒睡衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a pastel pink-and-white fluffy cat-ear fleece pajama set: an oversized hooded hoodie with realistic cat-ear hood and golden lightning bolt print, matching fleece shorts, ultra soft loungewear",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/static_paw_cozy_cat_pajamas/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/static_paw_cozy_cat_pajamas/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/static_paw_cozy_cat_pajamas/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/static_paw_cozy_cat_pajamas/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "salon_dreamer_work_apron",
        "outfitName": "梦想剪刀手·理发沙龙工装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a vintage hair-salon stylist work outfit: high twin ponytails with cat-paw scrunchies, a clean light pink-and-white striped shirt, and a soft sage work apron with pockets, folding pink cat ears visible",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/salon_dreamer_work_apron/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/salon_dreamer_work_apron/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/salon_dreamer_work_apron/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/salon_dreamer_work_apron/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/goldenglow_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/goldenglow_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/goldenglow_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/goldenglow_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "skadi_arknights": {
    "characterId": "skadi_arknights",
    "displayName": "斯卡蒂",
    "source": "Arknights",
    "identityProse": "Skadi from Arknights, an Abyss Hunter with very long ankle-length silver-white hair, crimson eyes, wearing a black high-cut bodysuit with red accents and a short black coat with a wide-brimmed hunter hat, carrying a huge greatsword in a black guitar case",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "深海猎人作战服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her black high-cut sleeveless bodysuit with red accents, a black cropped jacket with red lining, a black wide-brimmed hunter hat and black thigh-high boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "waverider",
        "outfitName": "驭浪（泳装）",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a red two-piece bikini with a translucent white cover-up, sunglasses and a killer-whale inflatable surfboard",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/waverider/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/waverider/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/waverider/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/waverider/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "sublimation",
        "outfitName": "升华（神官礼服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a pure white backless divine priestess gown with gold hollow ornaments and a sacred ritual staff",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/sublimation/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/sublimation/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/sublimation/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/sublimation/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cozy_orca_loungewear",
        "outfitName": "鲸梦独语·连帽卫衣居家服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an oversized dark charcoal hoodie with a cute white orca silhouette print and sleeves past the fingertips, black cotton lounge shorts, plush slippers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/cozy_orca_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/cozy_orca_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/cozy_orca_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/cozy_orca_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "quiet_barista_uniform",
        "outfitName": "静谧午后·咖啡店围裙便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a quiet barista outfit: a crisp white button-up collared shirt with sleeves rolled to the forearm, over a dark black canvas waist apron with a red pen and notepad in the front pocket, charcoal tailored trousers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/quiet_barista_uniform/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/quiet_barista_uniform/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/quiet_barista_uniform/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/quiet_barista_uniform/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "oceanic_symphony_gown",
        "outfitName": "海潮绝响·音律交响晚礼服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a haute couture Aegir symphony gown: a midnight-blue to deep-black gradient velvet strapless gown with a high side slit and faint silver wave embroidery, a single sheer crimson chiffon train draped over one shoulder",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/oceanic_symphony_gown/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/oceanic_symphony_gown/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/oceanic_symphony_gown/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/oceanic_symphony_gown/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/skadi_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/skadi_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/skadi_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/skadi_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "quillpen_arknights": {
    "characterId": "quillpen_arknights",
    "displayName": "羽毛笔",
    "source": "Arknights",
    "identityProse": "Quillpen from Arknights, a sleepy Liberi bartender with silver-white hair fading to coral pink at the tips reaching past her shoulders, a tall feather ahoge, drowsy half-lidded vermilion eyes, small feathered wings on the sides of her head, wearing a black crop top with an asymmetrical grey jacket and black hotpants, wielding a giant black mechanical scythe made by her brother Tequila",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "调酒师装",
        "isDefault": true,
        "isNsfw": false,
        "prose": "a black crop top with an asymmetrical grey hooded jacket, black hotpants, a tactical belt with a cocktail shaker pouch and a black choker, holding her giant scythe",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/quillpen_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/quillpen_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/quillpen_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/quillpen_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "summer_flower_fa210",
        "outfitName": "夏卉（泳装）",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a pink and white bikini with a translucent white cover-up, a floral straw hat and sunglasses, holding a tropical cocktail",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/quillpen_arknights/summer_flower_fa210/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/quillpen_arknights/summer_flower_fa210/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/quillpen_arknights/summer_flower_fa210/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/quillpen_arknights/summer_flower_fa210/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "sleepy_oversized_loungewear",
        "outfitName": "迷糊小憩慵懒大号连帽卫衣居家睡衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an oversized dusty pink-lilac pullover hoodie with sleeves far past the fingertips, white cotton lounge shorts underneath, cozy sleepy loungewear",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/quillpen_arknights/sleepy_oversized_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/quillpen_arknights/sleepy_oversized_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/quillpen_arknights/sleepy_oversized_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/quillpen_arknights/sleepy_oversized_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "classic_bartender_apron",
        "outfitName": "午夜特调经典调酒师工装围裙制服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a classic bartender outfit: a dark brown canvas half apron with leather harness straps over a crisp white short-sleeve collared shirt with a crimson ribbon tie at the collar",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/quillpen_arknights/classic_bartender_apron/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/quillpen_arknights/classic_bartender_apron/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/quillpen_arknights/classic_bartender_apron/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/quillpen_arknights/classic_bartender_apron/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "dossoles_tropical_casual",
        "outfitName": "多索雷斯假日热带海滨街头漫步便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a tropical resort casual outfit: a white off-shoulder ruffled crop top, high-waisted light-blue distressed denim shorts with a woven brown leather belt, strappy sandals",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/quillpen_arknights/dossoles_tropical_casual/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/quillpen_arknights/dossoles_tropical_casual/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/quillpen_arknights/dossoles_tropical_casual/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/quillpen_arknights/dossoles_tropical_casual/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/quillpen_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/quillpen_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/quillpen_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/quillpen_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "exusiai_arknights": {
    "characterId": "exusiai_arknights",
    "displayName": "能天使",
    "source": "Arknights",
    "identityProse": "Exusiai from Arknights, a cheerful Sankta courier of Penguin Logistics with short orange-red hair, red-brown eyes, a floating golden halo and small translucent wings, wearing a light grey-white hooded jacket over a black fitted shirt, black shorts and black thighhighs, carrying a Vector submachine gun",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "企鹅物流制服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her light grey-white hooded windbreaker with black colorblock trim over a black fitted shirt, black shorts, black thighhighs and black-and-white tactical sneakers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "city_rider",
        "outfitName": "城市骑手（KFC联动）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a red and white delivery rider jacket with a baseball cap, white t-shirt, black shorts and red-striped socks, holding a fried chicken box",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/city_rider/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/city_rider/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/city_rider/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/city_rider/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "midnight_courier",
        "outfitName": "午夜邮差（夜行装）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a black hooded techwear coat with fluorescent yellow reflective stripes, a waterproof messenger bag and dark tactical boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/midnight_courier/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/midnight_courier/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/midnight_courier/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/midnight_courier/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "lazy_dorm_oversized_loungewear",
        "outfitName": "罗德岛宿舍慵懒开黑居家服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "an extra-oversized heather-grey crewneck sweatshirt with the hem falling to mid-thigh in a lazy shirt-dress look, red-and-white striped fluffy knee-high socks, tiny cotton shorts underneath",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/lazy_dorm_oversized_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/lazy_dorm_oversized_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/lazy_dorm_oversized_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/lazy_dorm_oversized_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "apple_pie_bakery_patissiere",
        "outfitName": "甜心烘焙师·苹果派围裙装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a warm home-baking outfit: a cream loose-knit sweater, beige pleated mini skirt, brown cotton tights, and a vintage beige strap apron with a small apple print",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/apple_pie_bakery_patissiere/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/apple_pie_bakery_patissiere/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/apple_pie_bakery_patissiere/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/apple_pie_bakery_patissiere/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "lungmen_streetwear_skater",
        "outfitName": "龙门街头机能滑板潮服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dynamic streetwear outfit: an oversized red-and-white colorblock hoodie over a translucent techwear utility vest, over-ear wireless headphones around the neck, black cargo pants and chunky sneakers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/lungmen_streetwear_skater/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/lungmen_streetwear_skater/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/lungmen_streetwear_skater/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/lungmen_streetwear_skater/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/exusiai_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/exusiai_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/exusiai_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/exusiai_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "suzuran_arknights": {
    "characterId": "suzuran_arknights",
    "displayName": "铃兰",
    "source": "Arknights",
    "identityProse": "Suzuran from Arknights, a gentle Vulpo girl with long pale gold hair, light blue eyes, golden fox ears and nine fluffy fox tails, wearing a white haori jacket with dark green trim over a dark pleated skirt with white over-knee socks, holding a staff",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "白狐和服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her white haori jacket with dark green trim and a knotted cord over a dark pleated skirt, white over-knee socks and brown lace-up boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "snow_clearing",
        "outfitName": "雪霁（冬装和服）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a thick white and powder-blue winter kimono with fur trim, a floral hairpin and a wooden staff with shrine bells, standing before a torii gate in snow",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/snow_clearing/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/snow_clearing/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/snow_clearing/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/snow_clearing/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "wasteland_bloom",
        "outfitName": "弃土花开（废土探索）",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a moss green and khaki explorer coat with a bucket hat, a heavy backpack and hiking boots, her nine tails poking out from behind",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/wasteland_bloom/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/wasteland_bloom/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/wasteland_bloom/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/wasteland_bloom/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cozy_fluffy_pajamas",
        "outfitName": "【小憩时光】软绵绵小狐狸居家睡衣",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a pastel fleece loungewear set in cream white, butter yellow and peach pink: an extremely oversized fluffy hoodie with a hood and matching fleece shorts, soft cozy pajamas",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/cozy_fluffy_pajamas/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/cozy_fluffy_pajamas/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/cozy_fluffy_pajamas/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/cozy_fluffy_pajamas/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "greenhouse_florist_smock",
        "outfitName": "【初绽之息】阳光温室花艺师便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cottagecore florist outfit: a linen pinafore apron dress in oat and coffee tones over an ivory puff-sleeve blouse, brass buttons and a front pocket, gardening smock",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/greenhouse_florist_smock/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/greenhouse_florist_smock/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/greenhouse_florist_smock/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/greenhouse_florist_smock/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "higashi_summer_yukata",
        "outfitName": "【夏日微风】东国夏日祭轻风浴衣",
        "isDefault": false,
        "isNsfw": true,
        "prose": "a Japanese summer festival yukata in pale mint green, pastel pink and ivory, printed with swimming red goldfish, light cotton fabric with an obi sash",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/higashi_summer_yukata/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/higashi_summer_yukata/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/higashi_summer_yukata/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/higashi_summer_yukata/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/suzuran_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/suzuran_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/suzuran_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/suzuran_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "perlica_arknights": {
    "characterId": "perlica_arknights",
    "displayName": "佩丽卡",
    "source": "Arknights: Endfield",
    "identityProse": "Perlica from Arknights: Endfield, a composed Endfield Industries supervisor with platinum short hair with soft cyan gradient tips, light blue eyes, feline cat ears and a cat tail, mechanical hair clips, wearing a white and charcoal tactical jacket with cyan accents over a black pleated skirt with black thighhighs",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "终末地制服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "her white and charcoal Endfield supervisor tactical jacket with cyan line accents over a black pleated skirt, black thighhighs, tactical boots and a utility belt, mechanical hair clips",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/perlica_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/perlica_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/perlica_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/perlica_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "wasteland_explorer",
        "outfitName": "荒野探索装",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a khaki hooded explorer coat with cargo pants, a heavy backpack and hiking boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/perlica_arknights/wasteland_explorer/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/perlica_arknights/wasteland_explorer/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/perlica_arknights/wasteland_explorer/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/perlica_arknights/wasteland_explorer/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "supervisor_lounge_knitwear",
        "outfitName": "中枢静谧时光",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cozy oversized chunky cream-white knit sweater with a relaxed neckline showing the collarbone, high-waist lounge trousers, soft indoor loungewear",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/perlica_arknights/supervisor_lounge_knitwear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/perlica_arknights/supervisor_lounge_knitwear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/perlica_arknights/supervisor_lounge_knitwear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/perlica_arknights/supervisor_lounge_knitwear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "endfield_techwear_street",
        "outfitName": "都市机能风尚",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a cyberpunk techwear street outfit: a cropped black-and-white techwear biker jacket over a ribbed charcoal crop tank top, high-waist techwear cargo pants with cyan line accents and straps, chunky sneakers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/perlica_arknights/endfield_techwear_street/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/perlica_arknights/endfield_techwear_street/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/perlica_arknights/endfield_techwear_street/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/perlica_arknights/endfield_techwear_street/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "sub_zero_frostfield_parka",
        "outfitName": "极地破风巡航",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a heavy insulated arctic parka in glacier white and grey-blue panels with a fluffy white fur-lined hood, worn over a thermal turtleneck and insulated trousers, winter combat gear",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/perlica_arknights/sub_zero_frostfield_parka/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/perlica_arknights/sub_zero_frostfield_parka/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/perlica_arknights/sub_zero_frostfield_parka/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/perlica_arknights/sub_zero_frostfield_parka/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/perlica_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/perlica_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/perlica_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/perlica_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  },
  "laevatain_arknights": {
    "characterId": "laevatain_arknights",
    "displayName": "莱万汀",
    "source": "Arknights: Endfield",
    "identityProse": "Laevatain from Arknights: Endfield, a fierce Sarkaz swordsman with long crimson wavy hair, red eyes, curved black horns and a black devil tail, wearing a dark grey and industrial-white cropped tactical coat with yellow warning stripes over a black high-neck crop top and black shorts with thigh straps, wielding a huge molten greatsword",
    "outfits": [
      {
        "outfitId": "standard",
        "outfitName": "战术特勤服",
        "isDefault": true,
        "isNsfw": false,
        "prose": "a dark grey and industrial-white cropped tactical coat with yellow warning stripes over a black high-neck crop top, black shorts, thigh straps and high combat boots",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/laevatain_arknights/standard/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/laevatain_arknights/standard/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/laevatain_arknights/standard/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/laevatain_arknights/standard/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "ignition",
        "outfitName": "熔火姿态",
        "isDefault": false,
        "isNsfw": false,
        "prose": "her tactical outfit fully ignited with molten flame aura, the greatsword core vents open and spraying heat particles",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/laevatain_arknights/ignition/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/laevatain_arknights/ignition/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/laevatain_arknights/ignition/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/laevatain_arknights/ignition/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "cozy_dorm_loungewear",
        "outfitName": "极简落肩·休息舱私服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a minimalist cozy loungewear for a private cabin: an oversized charcoal drop-shoulder hoodie with a tail slot at the back hem, soft cotton lounge shorts, over-knee cotton socks",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/laevatain_arknights/cozy_dorm_loungewear/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/laevatain_arknights/cozy_dorm_loungewear/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/laevatain_arknights/cozy_dorm_loungewear/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/laevatain_arknights/cozy_dorm_loungewear/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "street_cafe_sweet",
        "outfitName": "绯红甜意·街头机能便服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a light techwear street outfit for a cafe visit: a black halter crop top under a slightly open cropped sheer grey techwear jacket, black high-waist pleated utility miniskirt with metal buckles and dark red lining, chunky sneakers",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/laevatain_arknights/street_cafe_sweet/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/laevatain_arknights/street_cafe_sweet/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/laevatain_arknights/street_cafe_sweet/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/laevatain_arknights/street_cafe_sweet/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "obsidian_formal_gown",
        "outfitName": "黑曜夜华·萨卡兹晚礼服",
        "isDefault": false,
        "isNsfw": false,
        "prose": "a dramatic black-to-crimson gradient haute couture evening gown: a halter-neck deep plunge gown with an open back, the black tail emerging seamlessly from the open back, elegant high fashion",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/laevatain_arknights/obsidian_formal_gown/ref_04_back_rear.png"
          }
        ]
      },
      {
        "outfitId": "nsfw_nude",
        "outfitName": "私密全裸 / 纯粹形态",
        "isDefault": false,
        "isNsfw": true,
        "prose": "completely naked, full nudity, bare skin, natural female body, breasts, pink nipples, slender waist, navel, bare shoulders, collarbone, bare legs, bare feet, clean soft cinematic studio lighting",
        "references": [
          {
            "id": "ref_01_face_closeup",
            "name": "面部特写",
            "shotType": "特写 · 85mm 浅景深",
            "lens": "85mm f/1.4 Portrait Lens",
            "targetUsage": [
              "对白特写",
              "微表情",
              "情绪反应镜头",
              "台词对峙"
            ],
            "fileName": "ref_01_face_closeup.png",
            "url": "/assets/character-references/laevatain_arknights/nsfw_nude/ref_01_face_closeup.png"
          },
          {
            "id": "ref_02_half_medium",
            "name": "3/4半身定妆",
            "shotType": "半身 · 中景",
            "lens": "50mm Medium Lens",
            "targetUsage": [
              "对话交互",
              "过肩推拉",
              "室内中景",
              "双人互动"
            ],
            "fileName": "ref_02_half_medium.png",
            "url": "/assets/character-references/laevatain_arknights/nsfw_nude/ref_02_half_medium.png"
          },
          {
            "id": "ref_03_full_dynamic",
            "name": "正面全身立姿",
            "shotType": "全身 · 广角 50mm",
            "lens": "50mm Wide Frame",
            "targetUsage": [
              "登场走入",
              "全景走位",
              "全身动作",
              "空间交代"
            ],
            "fileName": "ref_03_full_dynamic.png",
            "url": "/assets/character-references/laevatain_arknights/nsfw_nude/ref_03_full_dynamic.png"
          },
          {
            "id": "ref_04_back_rear",
            "name": "45°侧后背影",
            "shotType": "侧后 · 轮廓光",
            "lens": "85mm Cinematic Edge",
            "targetUsage": [
              "过肩反打",
              "转身离去",
              "背影叙事",
              "神秘氛围"
            ],
            "fileName": "ref_04_back_rear.png",
            "url": "/assets/character-references/laevatain_arknights/nsfw_nude/ref_04_back_rear.png"
          }
        ]
      }
    ]
  }
}

export function getCharacterReferences(characterId: string): CharacterReferenceProfile | undefined {
  return CHARACTER_REFERENCE_STANDARDS[characterId]
}
