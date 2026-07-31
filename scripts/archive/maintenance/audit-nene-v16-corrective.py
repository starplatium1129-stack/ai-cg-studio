"""Run stricter original-outfit prompt-adherence gates for Nene v16."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


SOURCE_PATH = Path(__file__).with_name("audit-nene-v16.py")
SPEC = importlib.util.spec_from_file_location("nene_v16_audit", SOURCE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot load {SOURCE_PATH}")
SOURCE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = SOURCE
SPEC.loader.exec_module(SOURCE)


SOURCE.OUTPUT = Path(
    r"E:\code\2\lora\AI\Reviews\ModelEvaluations\nene_v16_corrective_gate_2026-07-29"
)

quality = SOURCE.QUALITY
identity = SOURCE.IDENTITY
refs = SOURCE.REFERENCES
SOURCE.TESTS = [
    SOURCE.Test(
        "school-original-corrective",
        f"{quality}, {identity}, full_body, standing, exact_official_school_uniform, "
        "fitted_navy_school_blazer, thin_gold_piping, four_gold_buttons, plain_collar, "
        "gray_plaid_pleated_skirt, dark_gray_thighhighs, black_mary_janes, "
        "no_neck_ribbon, no_neck_bow, no_bowtie, no_necktie, no_chest_crest, "
        "looking_at_viewer, simple_background, soft_even_lighting",
        refs / "nene_stand_02.png",
        "full",
        "neck_ribbon, neck_bow, bowtie, necktie, chest_crest, chest_emblem",
    ),
    SOURCE.Test(
        "witch-original-corrective",
        f"{quality}, {identity}, full_body, standing, exact_official_witch_outfit, "
        "large_black_witch_hat, pink_striped_hatband, large_pink_hat_bow, "
        "black_short_cape, vivid_pink_cape_lining, pink_crisscross_strappy_top, "
        "pink_collar, gold_buckle, exposed_midriff, black_pleated_miniskirt, "
        "asymmetrical_legwear, exactly_one_black_and_white_striped_thighhigh, "
        "the_other_leg_bare_with_one_short_white_frilled_sock, only_one_striped_stocking, "
        "black_strappy_boots, holding_silver_handgun_downward, looking_at_viewer, "
        "simple_background",
        refs / "nene_stand_01.png",
        "full",
        "pink_and_white_striped_stocking, two_striped_stockings, symmetric_legwear, "
        "black_solid_thighhigh, long_white_stocking",
    ),
    SOURCE.Test(
        "witch-scene-generalization",
        f"{quality}, {identity}, full_body, dynamic_three-quarter_pose, "
        "exact_official_witch_outfit, large_black_witch_hat, pink_striped_hatband, "
        "large_pink_hat_bow, black_short_cape, vivid_pink_cape_lining, "
        "pink_crisscross_strappy_top, black_pleated_miniskirt, "
        "exactly_one_black_and_white_striped_thighhigh, the_other_leg_bare_with_one_short_white_frilled_sock, "
        "black_strappy_boots, holding_silver_handgun_downward, casting_purple_magic, "
        "moonlit_classroom, cinematic_rim_light, detailed_background",
        refs / "nene_stand_01.png",
        "full",
        "pink_and_white_striped_stocking, two_striped_stockings, symmetric_legwear, "
        "black_solid_thighhigh, empty_background, character_reference_sheet, decorative_frame",
    ),
]


if __name__ == "__main__":
    SOURCE.main()
