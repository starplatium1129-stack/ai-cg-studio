#!/usr/bin/env python3
"""Build the manually reviewed unified Nene v18 training dataset.

The dataset deliberately keeps safe and R18 material in one LoRA while using
``nene_r18`` as a protected conditional gate.  Every exported image is an
untouched source copy.  Visually related expression or pose variants share a
dedupe group and are capped at three sources.

This builder is intentionally explicit rather than a directory scraper:
adding a source requires recording the visible identity traits, outfit facts,
content class, camera/pose facts and the manual-review evidence in code.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont, ImageOps


TRIGGER = "ayachi_nene"
R18_TRIGGER = "nene_r18"
REVIEW_DATE = "2026-07-29"
REVIEWER = "Codex GPT-5 current-model visual audit"
CANONICAL_IDENTITY = (
    "white_hair",
    "very_long_hair",
    "low_twintails",
    "purple_eyes",
    "ahoge",
    "pink_hair_ribbons",
)
CANONICAL_WITCH = (
    "nene_witch_canonical",
    "official_witch_outfit",
    "witch_hat",
    "pink_hat_band",
    "large_pink_hat_bow",
    "black_cape",
    "pink_lining",
    "pink_crossover_top",
    "black_skirt",
    "asymmetric_legwear",
    "black_white_striped_thighhigh",
    "bare_other_leg",
    "white_frilled_anklet",
    "black_strappy_boots",
)
WITCH_CG_VISIBLE = (
    "nene_witch_canonical",
    "official_witch_outfit",
    "witch_hat",
    "pink_hat_band",
    "large_pink_hat_bow",
    "black_cape",
    "pink_lining",
    "pink_crossover_top",
)
FACT_ORDER = ("subject", "camera", "pose", "attire_state", "expression", "scene")
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass(frozen=True)
class SourceSpec:
    key: str
    source: Path
    dedupe_group: str
    r18: bool
    subject_scope: str
    view: str
    visible_identity_tags: tuple[str, ...]
    visible_outfit_tags: tuple[str, ...]
    facts: dict[str, tuple[str, ...]]
    evidence: str
    identity_anchor: bool = False
    full_body: bool = False
    outfit_role: str = ""

    @property
    def category(self) -> str:
        if self.outfit_role == "canonical_witch_full_body":
            return "witch_full_body"
        if self.outfit_role == "canonical_witch_cg":
            return "witch_cg"
        return "identity_r18" if self.r18 else "identity_safe"


def fact(
    subject: str,
    camera: str,
    pose: str,
    attire_state: str,
    expression: str,
    scene: str,
) -> dict[str, tuple[str, ...]]:
    return {
        "subject": (subject,),
        "camera": (camera,),
        "pose": (pose,),
        "attire_state": (attire_state,),
        "expression": (expression,),
        "scene": (scene,),
    }


def ordered_identity(*tags: str) -> tuple[str, ...]:
    requested = set(tags)
    unknown = requested - set(CANONICAL_IDENTITY)
    if unknown:
        raise ValueError(f"unknown identity tags: {sorted(unknown)}")
    return tuple(tag for tag in CANONICAL_IDENTITY if tag in requested)


def unique_tags(tags: Iterable[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for raw in tags:
        tag = raw.strip().lower()
        if tag and tag not in seen:
            seen.add(tag)
            result.append(tag)
    return result


def caption_for(spec: SourceSpec) -> str:
    tags: list[str] = [TRIGGER]
    if spec.r18:
        tags.append(R18_TRIGGER)
    tags.extend(spec.visible_identity_tags)
    tags.extend(spec.visible_outfit_tags)
    for group in FACT_ORDER:
        tags.extend(spec.facts[group])
    return ", ".join(unique_tags(tags))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def make_specs(ai_root: Path) -> list[SourceSpec]:
    v12 = ai_root / "Datasets" / "Characters" / "Ayachi_Nene" / "V12"
    legacy = ai_root / "Datasets" / "Characters" / "Ayachi_Nene" / "Legacy"
    official = ai_root / "Assets" / "OfficialCG" / "绫地宁宁"
    shortlist = ai_root / "Assets" / "VisualPipeline" / "r18_identity_shortlist" / "nene"

    school = (
        "nene_school_uniform",
        "navy_blazer",
        "gold_piping",
        "grey_plaid_skirt",
        "yellow_neck_bow",
    )
    school_close = ("nene_school_uniform", "navy_blazer", "yellow_neck_bow")
    red_cardigan = ("red_cardigan", "white_blouse", "yellow_neck_bow", "dark_skirt")
    pajamas = ("blue_cat_print_pajamas", "pink_collar")
    green_sleepwear = ("green_polka_dot_sleepwear",)
    black_bat_dress = ("black_bat_dress", "white_bust_panel", "bat_hair_accessories")
    alternate_witch = (
        "alternate_revealing_witch_costume",
        "witch_hat",
        "pink_hat_band",
        "large_pink_hat_bow",
        "black_cape",
        "red_strappy_top",
        "black_miniskirt",
    )

    specs: list[SourceSpec] = []

    def add(
        key: str,
        source: Path,
        group: str,
        *,
        r18: bool,
        scope: str,
        view: str,
        identity: tuple[str, ...],
        outfit: tuple[str, ...],
        facts: dict[str, tuple[str, ...]],
        evidence: str,
        anchor: bool = False,
        full_body: bool = False,
        outfit_role: str = "",
    ) -> None:
        specs.append(
            SourceSpec(
                key=key,
                source=source,
                dedupe_group=group,
                r18=r18,
                subject_scope=scope,
                view=view,
                visible_identity_tags=identity,
                visible_outfit_tags=outfit,
                facts=facts,
                evidence=f"Current-model per-image review: {evidence}",
                identity_anchor=anchor,
                full_body=full_body,
                outfit_role=outfit_role,
            )
        )

    # Official safe/R18 route CG groups.  Each group keeps no more than three
    # genuinely different expressions or interaction states.
    id_5001 = ordered_identity(
        "white_hair", "very_long_hair", "low_twintails", "purple_eyes", "pink_hair_ribbons"
    )
    add(
        "official_5001_base",
        v12 / "v12_cg_01.png",
        "official_5001_library_contact",
        r18=False,
        scope="interaction",
        view="right_three_quarter",
        identity=id_5001,
        outfit=school_close,
        facts=fact("interaction", "close_up", "embracing", "fully_clothed", "concerned_expression", "library"),
        evidence="clear open-eyed face, canonical ribboned hair and clothed library embrace; no explicit exposure",
        anchor=True,
    )
    add(
        "official_5001_ab",
        official / "5001_AB.png",
        "official_5001_library_contact",
        r18=True,
        scope="interaction",
        view="right_three_quarter",
        identity=id_5001,
        outfit=school_close,
        facts=fact("interaction", "close_up", "intimate_contact", "fully_clothed", "blush", "library"),
        evidence="same library composition with explicit intimate touching; face and school outfit remain visible",
    )
    add(
        "official_5001_ba",
        official / "5001_BA.png",
        "official_5001_library_contact",
        r18=True,
        scope="interaction",
        view="right_three_quarter",
        identity=id_5001,
        outfit=school_close,
        facts=fact("interaction", "close_up", "sexual_contact", "fully_clothed", "blush", "library"),
        evidence="open-eyed face, pink hair ribbon and explicit clothed sexual contact are all visible",
    )

    id_5002 = ordered_identity("white_hair", "very_long_hair", "purple_eyes")
    for key, path, expression, anchor in (
        ("official_5002_base", v12 / "v12_cg_02.png", "gentle_expression", True),
        ("official_5002_ab", official / "5002_AB.png", "soft_smile", False),
        ("official_5002_ad", official / "5002_AD.png", "surprised_expression", False),
    ):
        add(
            key,
            path,
            "official_5002_classroom_portrait",
            r18=False,
            scope="solo",
            view="front",
            identity=id_5002,
            outfit=school_close,
            facts=fact("solo", "close_up", "facing_viewer", "fully_clothed", expression, "classroom"),
            evidence=f"clean solo classroom face variant with open purple eyes ({expression})",
            anchor=anchor,
        )

    id_5003 = ordered_identity(
        "white_hair", "very_long_hair", "low_twintails", "purple_eyes", "pink_hair_ribbons"
    )
    for key, path, expression, anchor in (
        ("official_5003_base_a", v12 / "v12_cg_03.png", "worried_expression", True),
        ("official_5003_base_b", v12 / "v12_cg_04.png", "soft_expression", False),
        ("official_5003_ab", official / "5003_AB.png", "surprised_expression", False),
    ):
        add(
            key,
            path,
            "official_5003_night_support",
            r18=False,
            scope="interaction",
            view="left_three_quarter",
            identity=id_5003,
            outfit=school,
            facts=fact("interaction", "low_angle", "supporting_person", "fully_clothed", expression, "night_street"),
            evidence=f"clear face and ribboned low twintails in a clothed night interaction ({expression})",
            anchor=anchor,
        )

    id_5004_open = ordered_identity("white_hair", "very_long_hair", "purple_eyes", "ahoge")
    id_5004_closed = ordered_identity("white_hair", "very_long_hair", "ahoge")
    add(
        "official_5004_base",
        v12 / "v12_cg_05.png",
        "official_5004_pajamas",
        r18=False,
        scope="solo",
        view="front",
        identity=id_5004_open,
        outfit=pajamas,
        facts=fact("solo", "close_up", "lying", "fully_clothed", "gentle_expression", "bedroom"),
        evidence="solo open-eyed pajama portrait with unobstructed face and ahoge",
        anchor=True,
    )
    add(
        "official_5004_ab",
        official / "5004_AB.png",
        "official_5004_pajamas",
        r18=False,
        scope="solo",
        view="front",
        identity=id_5004_open,
        outfit=pajamas,
        facts=fact("solo", "close_up", "lying", "fully_clothed", "neutral_expression", "bedroom"),
        evidence="open-eyed alternate expression in the same fully clothed pajama composition",
    )
    add(
        "official_5004_ac",
        official / "5004_AC.png",
        "official_5004_pajamas",
        r18=False,
        scope="solo",
        view="front",
        identity=id_5004_closed,
        outfit=pajamas,
        facts=fact("solo", "close_up", "lying", "fully_clothed", "crying", "bedroom"),
        evidence="eyes-closed crying expression; purple eyes are deliberately not claimed",
    )

    id_5005_open = ordered_identity("white_hair", "very_long_hair", "purple_eyes")
    id_5005_closed = ordered_identity("white_hair", "very_long_hair")
    for key, path, identity, expression in (
        ("official_5005_base", v12 / "v12_cg_06.png", id_5005_open, "surprised_expression"),
        ("official_5005_ab", official / "5005_AB.png", id_5005_open, "neutral_expression"),
        ("official_5005_be", official / "5005_BE.png", id_5005_closed, "crying_smile"),
    ):
        add(
            key,
            path,
            "official_5005_clothed_lap",
            r18=False,
            scope="interaction",
            view="front",
            identity=identity,
            outfit=school,
            facts=fact("interaction", "medium_shot", "lap_pillow", "fully_clothed", expression, "classroom"),
            evidence=f"fully clothed lap-pillow interaction ({expression}); no nudity or explicit exposure",
        )

    id_5006 = ordered_identity(*CANONICAL_IDENTITY)
    for key, path, expression, anchor in (
        ("official_5006_base_a", v12 / "v12_cg_07.png", "gentle_expression", True),
        ("official_5006_base_b", v12 / "v12_cg_08.png", "soft_smile", False),
        ("official_5006_ca", official / "5006_CA.png", "surprised_expression", False),
    ):
        add(
            key,
            path,
            "official_5006_red_cardigan",
            r18=False,
            scope="interaction",
            view="right_three_quarter",
            identity=id_5006,
            outfit=red_cardigan,
            facts=fact("interaction", "medium_shot", "leaning_on_person", "fully_clothed", expression, "indoor_scene"),
            evidence=f"clothed red-cardigan interaction with full canonical hair silhouette ({expression})",
            anchor=anchor,
        )

    id_5007 = ordered_identity(*CANONICAL_IDENTITY)
    for key, path, expression, anchor in (
        ("official_5007_base_a", v12 / "v12_cg_09.png", "gentle_expression", True),
        ("official_5007_base_b", v12 / "v12_cg_10.png", "soft_smile", False),
        ("official_5007_ab", official / "5007_AB.png", "surprised_expression", False),
    ):
        add(
            key,
            path,
            "official_5007_event_uniform",
            r18=False,
            scope="solo",
            view="front",
            identity=id_5007,
            outfit=school,
            facts=fact("solo", "low_angle", "standing", "fully_clothed", expression, "event_stage"),
            evidence=f"solo school-uniform event view with complete canonical hair features ({expression})",
            anchor=anchor,
        )

    # Sole canonical witch CG and sole complete full-body official stand.
    add(
        "canonical_witch_cg",
        v12 / "v12_cg_11.png",
        "canonical_witch_official_cg",
        r18=False,
        scope="solo",
        view="front",
        identity=ordered_identity("white_hair", "very_long_hair", "purple_eyes"),
        outfit=WITCH_CG_VISIBLE,
        facts=fact("solo", "medium_shot", "aiming_handgun", "canonical_witch_upper_outfit", "determined_expression", "starry_background"),
        evidence="the only canonical witch composition CG; upper outfit and handgun are visible, legs and footwear are not",
        outfit_role="canonical_witch_cg",
    )
    add(
        "canonical_witch_full_body",
        v12 / "v12_stand_01.png",
        "canonical_witch_full_body_stand",
        r18=False,
        scope="solo",
        view="front",
        identity=ordered_identity("white_hair", "very_long_hair", "low_twintails", "purple_eyes"),
        outfit=CANONICAL_WITCH,
        facts=fact("solo", "full_body", "standing", "canonical_witch_full_outfit", "neutral_expression", "plain_background"),
        evidence="untouched full-body official stand proves hat, cape, skirt, asymmetric striped/bare legs, anklet and strapped boots",
        full_body=True,
        outfit_role="canonical_witch_full_body",
    )

    add(
        "school_uniform_full_body",
        v12 / "v12_stand_02.png",
        "official_school_full_body_stand",
        r18=False,
        scope="solo",
        view="front",
        identity=ordered_identity(*CANONICAL_IDENTITY),
        outfit=school + ("dark_thighhighs", "mary_jane_shoes"),
        facts=fact("solo", "full_body", "standing", "fully_clothed", "neutral_expression", "plain_background"),
        evidence="clean official full-body school stand with face, complete ribboned hair, skirt, thighhighs and shoes",
        anchor=True,
        full_body=True,
    )
    add(
        "casual_full_body",
        v12 / "v12_stand_03.png",
        "official_casual_full_body_stand",
        r18=False,
        scope="solo",
        view="right_three_quarter",
        identity=ordered_identity(
            "white_hair", "very_long_hair", "low_twintails", "purple_eyes", "ahoge", "pink_hair_ribbons"
        ),
        outfit=("red_cardigan", "black_skirt", "white_frilled_anklets", "red_strappy_shoes"),
        facts=fact("solo", "full_body", "standing", "fully_clothed", "neutral_expression", "plain_background"),
        evidence="official full-body casual stand; both overall silhouette and visible footwear are retained",
        anchor=True,
        full_body=True,
    )
    add(
        "bat_dress_full_body",
        v12 / "v12_stand_04.png",
        "official_bat_dress_full_body_stand",
        r18=False,
        scope="solo",
        view="left_three_quarter",
        identity=ordered_identity("white_hair", "very_long_hair", "purple_eyes", "ahoge"),
        outfit=black_bat_dress,
        facts=fact("solo", "full_body", "standing", "fully_clothed", "neutral_expression", "plain_background"),
        evidence="official alternate black dress stand; black bat accessories are not mislabeled as pink ribbons",
        anchor=True,
        full_body=True,
    )

    # R18 groups: use full-resolution route images where available, with at
    # most two reviewed screenshot variants from the same visual source group.
    id_route_ribbon = ordered_identity(
        "white_hair", "very_long_hair", "low_twintails", "purple_eyes", "pink_hair_ribbons"
    )
    add(
        "r18_ev101",
        shortlist / "nene_ev101_entry_00001_5001.png",
        "r18_ev101_library_skirt",
        r18=True,
        scope="solo",
        view="right_three_quarter",
        identity=id_route_ribbon,
        outfit=school,
        facts=fact("solo", "low_angle", "skirt_lift", "underwear_exposure", "blush", "library"),
        evidence="full-resolution solo under-skirt scene with clear open-eyed face, long ribboned hair and school uniform",
        anchor=True,
    )
    add(
        "r18_ev101_variant",
        legacy / "ScreenShot_2026-07-12_230616_069.png",
        "r18_ev101_library_skirt",
        r18=True,
        scope="solo",
        view="right_three_quarter",
        identity=id_route_ribbon,
        outfit=school,
        facts=fact("solo", "low_angle", "skirt_lift", "underwear_exposure", "blush", "library"),
        evidence="reviewed expression/pose variant from the same under-skirt source group; group cap remains two",
    )

    id_braids = ordered_identity("white_hair", "very_long_hair", "purple_eyes")
    add(
        "r18_ev119",
        shortlist / "nene_ev119_entry_00011_500b.png",
        "r18_ev119_braided_bed",
        r18=True,
        scope="interaction",
        view="left_three_quarter",
        identity=id_braids,
        outfit=("green_polka_dot_sleepwear", "braided_pigtails"),
        facts=fact("interaction", "close_up", "lying", "topless", "blush", "bedroom"),
        evidence="full-resolution adult bed interaction; braided hair and clear open purple eyes are visible",
        anchor=True,
    )
    add(
        "r18_ev119_variant",
        legacy / "ScreenShot_2026-07-12_230938_392.png",
        "r18_ev119_braided_bed",
        r18=True,
        scope="interaction",
        view="left_three_quarter",
        identity=id_braids,
        outfit=("green_polka_dot_sleepwear", "braided_pigtails"),
        facts=fact("interaction", "close_up", "lying", "topless", "blush", "bedroom"),
        evidence="same adult braided-pajama group with a distinct reviewed interaction frame",
    )

    add(
        "r18_ev114",
        shortlist / "nene_ev114_entry_00006_5006.png",
        "r18_ev114_braided_solo",
        r18=True,
        scope="solo",
        view="front",
        identity=id_braids,
        outfit=("green_polka_dot_sleepwear", "braided_pigtails"),
        facts=fact("solo", "medium_shot", "lying", "bottomless", "blush", "bedroom"),
        evidence="full-resolution solo adult pose with clear face, open purple eyes and long braided hair",
        anchor=True,
    )
    for key, name, expression in (
        ("r18_ev114_variant_a", "ScreenShot_2026-07-12_231154_952.png", "blush"),
        ("r18_ev114_variant_b", "ScreenShot_2026-07-12_231203_106.png", "embarrassed_expression"),
    ):
        add(
            key,
            legacy / name,
            "r18_ev114_braided_solo",
            r18=True,
            scope="solo",
            view="front",
            identity=id_braids,
            outfit=("green_polka_dot_sleepwear", "braided_pigtails"),
            facts=fact("solo", "medium_shot", "lying", "bottomless", expression, "bedroom"),
            evidence=f"reviewed solo braided-hair variant ({expression}); no canonical ribbon or low-twintail claim",
        )

    add(
        "r18_ev115",
        shortlist / "nene_ev115_entry_00007_5007.png",
        "r18_ev115_yellow_bed_solo",
        r18=True,
        scope="solo",
        view="left_three_quarter",
        identity=id_braids,
        outfit=("light_blue_bra", "open_white_shirt"),
        facts=fact("solo", "close_up", "lying", "topless", "blush", "bedroom"),
        evidence="full-resolution solo torso and face; open purple eyes and long white hair are clear",
        anchor=True,
    )
    add(
        "r18_ev115_variant",
        legacy / "ScreenShot_2026-07-12_231408_046.png",
        "r18_ev115_yellow_bed_solo",
        r18=True,
        scope="solo",
        view="left_three_quarter",
        identity=id_braids,
        outfit=("light_blue_bra", "open_white_shirt"),
        facts=fact("solo", "close_up", "lying", "topless", "blush", "bedroom"),
        evidence="reviewed alternate expression from the same yellow-bed solo source group",
    )

    for key, name, expression in (
        ("r18_bed_contact_a", "ScreenShot_2026-07-12_231453_739.png", "blush"),
        ("r18_bed_contact_b", "ScreenShot_2026-07-12_231503_578.png", "surprised_expression"),
    ):
        add(
            key,
            legacy / name,
            "r18_legacy_bed_contact",
            r18=True,
            scope="interaction",
            view="right_three_quarter",
            identity=ordered_identity("white_hair", "very_long_hair", "purple_eyes"),
            outfit=("yellow_neck_bow", "light_blue_underwear"),
            facts=fact("interaction", "close_up", "lying", "topless", expression, "bedroom"),
            evidence=f"adult bed interaction with face visible ({expression}); two-frame group cap",
        )

    id_alt_witch = ordered_identity("white_hair", "very_long_hair", "low_twintails", "purple_eyes")
    add(
        "r18_ev118",
        shortlist / "nene_ev118_entry_00010_500a.png",
        "r18_ev118_alternate_strappy_solo",
        r18=True,
        scope="solo",
        view="left_three_quarter",
        identity=id_alt_witch,
        outfit=("alternate_strappy_costume", "red_crossover_top", "black_miniskirt", "long_gloves"),
        facts=fact("solo", "low_angle", "on_all_fours", "bottomless", "blush", "bedroom"),
        evidence="full-resolution explicit solo pose; costume is explicitly noncanonical and no official-witch trigger is used",
    )
    add(
        "r18_ev118_variant",
        legacy / "ScreenShot_2026-07-12_231624_346.png",
        "r18_ev118_alternate_strappy_solo",
        r18=True,
        scope="solo",
        view="left_three_quarter",
        identity=id_alt_witch,
        outfit=("alternate_strappy_costume", "red_crossover_top", "black_miniskirt", "long_gloves"),
        facts=fact("solo", "low_angle", "on_all_fours", "bottomless", "embarrassed_expression", "bedroom"),
        evidence="second reviewed expression in the same explicit noncanonical costume group",
    )
    add(
        "r18_ev118_close_variant",
        legacy / "ScreenShot_2026-07-12_232137_249.png",
        "r18_ev118_alternate_strappy_solo",
        r18=True,
        scope="solo",
        view="left_three_quarter",
        identity=id_alt_witch,
        outfit=("alternate_strappy_costume", "red_crossover_top", "black_cape", "long_gloves"),
        facts=fact("solo", "close_up", "lying", "topless", "embarrassed_expression", "bedroom"),
        evidence="close solo variant of the same noncanonical red strappy costume; no official-witch trigger is used",
    )

    id_close_face = ordered_identity("white_hair", "purple_eyes")
    add(
        "r18_ev121",
        shortlist / "nene_ev121_entry_00013_500d.png",
        "r18_ev121_bed_pov",
        r18=True,
        scope="solo",
        view="front",
        identity=id_close_face,
        outfit=("red_cardigan", "white_blouse", "pink_underwear"),
        facts=fact("solo", "pov", "lying", "bottomless", "blush", "bedroom"),
        evidence="full-resolution explicit POV; face is clear but off-frame hair length and ribbons are not claimed",
    )
    add(
        "r18_ev121_variant",
        legacy / "ScreenShot_2026-07-12_231827_124.png",
        "r18_ev121_bed_pov",
        r18=True,
        scope="solo",
        view="front",
        identity=id_close_face,
        outfit=("red_cardigan", "white_blouse", "pink_underwear"),
        facts=fact("solo", "pov", "lying", "bottomless", "embarrassed_expression", "bedroom"),
        evidence="same explicit POV group with a distinct expression; invisible long-hair traits remain unclaimed",
    )

    add(
        "r18_ev117",
        shortlist / "nene_ev117_entry_00009_5009.png",
        "r18_ev117_oral_interaction",
        r18=True,
        scope="interaction",
        view="front",
        identity=id_close_face,
        outfit=("red_cardigan", "white_blouse", "yellow_neck_bow"),
        facts=fact("interaction", "close_up", "oral_sex_pose", "partially_undressed", "blush", "indoor_scene"),
        evidence="full-resolution explicit oral interaction with unobstructed face; only visible white hair and purple eyes are claimed",
    )
    id_dark_interaction = ordered_identity("white_hair", "very_long_hair", "purple_eyes", "ahoge")
    add(
        "r18_ev123",
        shortlist / "nene_ev123_entry_00015_500f.png",
        "r18_ev123_dark_dress_interaction",
        r18=True,
        scope="interaction",
        view="left_three_quarter",
        identity=id_dark_interaction,
        outfit=("black_dress", "purple_lingerie"),
        facts=fact("interaction", "close_up", "lying", "topless", "blush", "bedroom"),
        evidence="full-resolution adult dark-dress interaction with open purple eyes and long hair visible",
    )
    for key, name, expression in (
        ("r18_ev123_variant_a", "ScreenShot_2026-07-12_232008_901.png", "blush"),
        ("r18_ev123_variant_b", "ScreenShot_2026-07-12_232023_115.png", "embarrassed_expression"),
    ):
        add(
            key,
            legacy / name,
            "r18_ev123_dark_dress_interaction",
            r18=True,
            scope="interaction",
            view="left_three_quarter",
            identity=id_dark_interaction,
            outfit=("black_dress", "purple_lingerie"),
            facts=fact("interaction", "close_up", "lying", "topless", expression, "bedroom"),
            evidence=f"reviewed dark-dress adult interaction variant ({expression}); source group is capped at three",
        )

    id_nude_stand_open = ordered_identity("white_hair", "very_long_hair", "purple_eyes", "ahoge")
    id_nude_stand_closed = ordered_identity("white_hair", "very_long_hair", "ahoge")
    for key, name, identity, expression, anchor in (
        ("r18_nude_stand_a", "ScreenShot_2026-07-12_232438_895.png", id_nude_stand_open, "blush", True),
        (
            "r18_nude_stand_b",
            "ScreenShot_2026-07-12_232458_716.png",
            id_nude_stand_closed,
            "embarrassed_expression",
            False,
        ),
    ):
        add(
            key,
            legacy / name,
            "r18_legacy_nude_stand",
            r18=True,
            scope="solo",
            view="front",
            identity=identity,
            outfit=(),
            facts=fact("solo", "full_body", "standing", "nude", expression, "indoor_scene"),
            evidence=f"clear front-facing solo nude body and face ({expression}); independent R18 identity/body group",
            anchor=anchor,
            full_body=True,
        )

    id_green_closed = ordered_identity("white_hair", "very_long_hair", "ahoge")
    id_green_open = ordered_identity("white_hair", "very_long_hair", "purple_eyes", "ahoge")
    for key, name, identity, expression, anchor in (
        ("safe_green_sleepwear_a", "ScreenShot_2026-07-12_232531_680.png", id_green_closed, "gentle_smile", False),
        ("safe_green_sleepwear_b", "ScreenShot_2026-07-12_232539_911.png", id_green_closed, "soft_smile", False),
        ("safe_green_sleepwear_c", "ScreenShot_2026-07-12_232548_705.png", id_green_open, "embarrassed_expression", True),
    ):
        add(
            key,
            legacy / name,
            "safe_legacy_green_sleepwear",
            r18=False,
            scope="solo",
            view="front",
            identity=identity,
            outfit=green_sleepwear + ("braided_pigtails",),
            facts=fact("solo", "full_body", "standing", "sleepwear", expression, "bedroom"),
            evidence=f"green polka-dot sleepwear solo variant ({expression}); open/closed eye traits are recorded literally",
            anchor=anchor,
            full_body=True,
        )

    id_black_open = ordered_identity("white_hair", "very_long_hair", "purple_eyes", "ahoge")
    id_black_closed = ordered_identity("white_hair", "very_long_hair", "ahoge")
    for key, name, identity, expression in (
        ("safe_black_bat_a", "ScreenShot_2026-07-12_232609_269.png", id_black_open, "embarrassed_expression"),
        ("safe_black_bat_b", "ScreenShot_2026-07-12_232619_441.png", id_black_closed, "soft_smile"),
    ):
        add(
            key,
            legacy / name,
            "safe_legacy_black_bat_dress",
            r18=False,
            scope="solo",
            view="front",
            identity=identity,
            outfit=black_bat_dress,
            facts=fact("solo", "full_body", "standing", "fully_clothed", expression, "night_street"),
            evidence=f"covered black bat dress with no nudity or sexual act ({expression}); kept outside the R18 gate",
            full_body=True,
        )

    id_alt_witch_open = ordered_identity("white_hair", "very_long_hair", "low_twintails", "purple_eyes")
    for key, name, expression in (
        ("r18_alternate_witch_a", "ScreenShot_2026-07-12_232656_703.png", "neutral_expression"),
        ("r18_alternate_witch_b", "ScreenShot_2026-07-12_232707_089.png", "embarrassed_expression"),
    ):
        add(
            key,
            legacy / name,
            "r18_legacy_alternate_witch",
            r18=True,
            scope="solo",
            view="front",
            identity=id_alt_witch_open,
            outfit=alternate_witch,
            facts=fact("solo", "full_body", "standing", "revealing_outfit", expression, "day_street"),
            evidence=f"highly revealing alternate witch-style costume ({expression}); explicitly not tagged canonical",
            full_body=True,
        )

    return specs


def preflight(specs: list[SourceSpec]) -> None:
    if len(specs) != 55:
        raise RuntimeError(f"v18 selection must contain exactly 55 sources, found {len(specs)}")
    keys = [spec.key for spec in specs]
    if len(keys) != len(set(keys)):
        raise RuntimeError("source keys must be unique")
    missing = [str(spec.source) for spec in specs if not spec.source.is_file()]
    if missing:
        raise FileNotFoundError(f"selected source files are missing: {missing}")
    hashes: dict[str, Path] = {}
    duplicate_hashes: list[tuple[Path, Path]] = []
    groups: dict[str, list[str]] = {}
    for spec in specs:
        digest = sha256(spec.source)
        prior = hashes.get(digest)
        if prior is not None:
            duplicate_hashes.append((prior, spec.source))
        else:
            hashes[digest] = spec.source
        groups.setdefault(spec.dedupe_group, []).append(spec.key)
        if spec.subject_scope not in {"solo", "interaction"}:
            raise RuntimeError(f"{spec.key}: unsupported subject scope")
        if set(spec.facts) != set(FACT_ORDER):
            raise RuntimeError(f"{spec.key}: facts must contain exactly {FACT_ORDER}")
        if spec.identity_anchor:
            if "white_hair" not in spec.visible_identity_tags or "purple_eyes" not in spec.visible_identity_tags:
                raise RuntimeError(f"{spec.key}: anchor lacks visible face colours")
            if len(spec.visible_identity_tags) < 3:
                raise RuntimeError(f"{spec.key}: anchor lacks three visible identity traits")
    if duplicate_hashes:
        rendered = [f"{left} == {right}" for left, right in duplicate_hashes]
        raise RuntimeError(f"exact duplicate selected source bytes: {rendered}")
    oversized = {group: members for group, members in groups.items() if len(members) > 3}
    if oversized:
        raise RuntimeError(f"dedupe group cap exceeded: {oversized}")
    if len(groups) < 22:
        raise RuntimeError(f"need at least 22 distinct visual groups, found {len(groups)}")


def build_audit_sheets(dataset: Path, entries: list[dict[str, object]]) -> list[Path]:
    sheet_dir = dataset / "audit-sheets"
    sheet_dir.mkdir(parents=True, exist_ok=True)
    try:
        font = ImageFont.truetype("arial.ttf", 20)
        small_font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
        small_font = font
    outputs: list[Path] = []
    for content_class, selected in (
        ("safe", [entry for entry in entries if not entry["r18"]]),
        ("r18", [entry for entry in entries if entry["r18"]]),
    ):
        page_size = 9
        for page_index in range(0, len(selected), page_size):
            batch = selected[page_index : page_index + page_size]
            canvas = Image.new("RGB", (1536, 1770), "#17171b")
            draw = ImageDraw.Draw(canvas)
            draw.text(
                (24, 18),
                f"Nene v18 {content_class.upper()} manual audit "
                f"{page_index // page_size + 1}/{(len(selected) + page_size - 1) // page_size}",
                fill="white",
                font=font,
            )
            for offset, entry in enumerate(batch):
                row, column = divmod(offset, 3)
                left = 24 + column * 504
                top = 68 + row * 560
                image_path = dataset / str(entry["file"])
                with Image.open(image_path) as raw:
                    source = ImageOps.exif_transpose(raw).convert("RGB")
                    source.thumbnail((480, 480), Image.Resampling.LANCZOS)
                image_left = left + (480 - source.width) // 2
                image_top = top + (480 - source.height) // 2
                canvas.paste(source, (image_left, image_top))
                label = f"{entry['id']} | {entry['review']['dedupe_group']}"
                draw.text((left, top + 486), label[:60], fill="#f4f0ff", font=small_font)
                draw.text(
                    (left, top + 510),
                    f"{entry['subject_scope']} | anchor={entry['review']['identity_complete']}",
                    fill="#c5bdd6",
                    font=small_font,
                )
            output = sheet_dir / f"nene-v18-{content_class}-{page_index // page_size + 1:02d}.jpg"
            canvas.save(output, quality=92, subsampling=0)
            outputs.append(output)
    return outputs


def write_audit_markdown(dataset: Path, entries: list[dict[str, object]], sheets: list[Path]) -> Path:
    safe = [entry for entry in entries if not entry["r18"]]
    r18 = [entry for entry in entries if entry["r18"]]
    anchors = [entry for entry in entries if entry["review"]["identity_complete"]]
    groups = {str(entry["review"]["dedupe_group"]) for entry in entries}
    lines = [
        "# 绫地宁宁 v18 统一训练集人工审核",
        "",
        f"- 审核日期：{REVIEW_DATE}",
        f"- 审核方式：当前模型逐图查看原图；文件名、旧 caption 和自动分数不作为通过依据",
        f"- 选中源图：{len(entries)}（安全 {len(safe)} / R18 {len(r18)}）",
        f"- 视觉来源组：{len(groups)}，每组最多 3 张",
        f"- 身份锚点：{len(anchors)}（安全 {sum(not item['r18'] for item in anchors)} / R18 {sum(bool(item['r18']) for item in anchors)}）",
        "- 模型结构：安全图和 R18 图进入同一个 LoRA；仅 R18 caption 固定第二词 `nene_r18`",
        "- 经典魔女服：仅 `v12_stand_01` 负责完整全身结构，仅 `v12_cg_11` 负责原作构图；其他魔女式服装均明确标为非经典",
        "- 服装事实：CG 不补写画面外的袜、踝饰或靴子；闭眼图不写 `purple_eyes`",
        "",
        "## 审核表",
        "",
    ]
    lines.extend(f"- `{sheet.relative_to(dataset).as_posix()}`" for sheet in sheets)
    lines.extend(
        [
            "",
            "## 最终清单",
            "",
            "| # | 类别 | 锚点 | 来源组 | 导出文件 |",
            "|---:|---|:---:|---|---|",
        ]
    )
    for index, entry in enumerate(entries, start=1):
        lines.append(
            f"| {index} | {'R18' if entry['r18'] else '安全'} | "
            f"{'是' if entry['review']['identity_complete'] else '否'} | "
            f"`{entry['review']['dedupe_group']}` | `{entry['file']}` |"
        )
    target = dataset / "SELECTION_AUDIT.md"
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return target


def build(ai_root: Path, output: Path, *, force: bool) -> tuple[Path, Path, list[Path]]:
    specs = make_specs(ai_root)
    preflight(specs)
    expected_parent = ai_root / "Datasets" / "Characters" / "Ayachi_Nene"
    if output.parent.resolve() != expected_parent.resolve() or output.name != "V18_Unified":
        raise RuntimeError(f"refusing unexpected dataset destination: {output}")
    if output.exists():
        if not force:
            raise FileExistsError(f"{output} already exists; pass --force to rebuild this generated dataset")
        shutil.rmtree(output)
    output.mkdir(parents=True)

    entries: list[dict[str, object]] = []
    for index, spec in enumerate(specs, start=1):
        category_dir = output / spec.category
        category_dir.mkdir(parents=True, exist_ok=True)
        suffix = spec.source.suffix.lower()
        destination = category_dir / f"{index:03d}_{spec.key}{suffix}"
        shutil.copy2(spec.source, destination)
        caption = caption_for(spec)
        destination.with_suffix(".txt").write_text(caption + "\n", encoding="utf-8")
        digest = sha256(spec.source)
        relative = destination.relative_to(output).as_posix()
        entries.append(
            {
                "id": spec.key,
                "file": relative,
                "source_file": str(spec.source.resolve()),
                "source_sha256": digest,
                "export_sha256": sha256(destination),
                "caption": caption,
                "category": spec.category,
                "kind": "source_copy",
                "subject_scope": spec.subject_scope,
                "r18": spec.r18,
                "outfit_role": spec.outfit_role,
                "facts": {group: list(spec.facts[group]) for group in FACT_ORDER},
                "review": {
                    "approved": True,
                    "reviewer": REVIEWER,
                    "reviewed_at": REVIEW_DATE,
                    "evidence": spec.evidence,
                    "content_class": "r18" if spec.r18 else "safe",
                    "face_visible": True,
                    "identity_complete": spec.identity_anchor,
                    "full_body": spec.full_body,
                    "visible_identity_tags": list(spec.visible_identity_tags),
                    "visible_outfit_tags": list(spec.visible_outfit_tags),
                    "view": spec.view,
                    "dedupe_group": spec.dedupe_group,
                },
            }
        )

    manifest = {
        "schema": "ai-cg-studio.nene-unified-dataset/v18",
        "version": "v18",
        "character": "绫地宁宁",
        "base_model_family": "Stable Diffusion XL / Illustrious",
        "selection_policy": {
            "method": "current-model manual inspection of every selected original",
            "exact_source_copies_only": True,
            "minimum_sources": 55,
            "minimum_visual_groups": 22,
            "maximum_sources_per_visual_group": 3,
            "same_lora_for_safe_and_r18": True,
            "r18_is_caption_condition": True,
            "classic_witch_cg_count": 1,
            "classic_witch_full_body_count": 1,
        },
        "unified_training_contract": {
            "model_count": 1,
            "trigger": TRIGGER,
            "r18_trigger": R18_TRIGGER,
            "safe_tag_shuffling": True,
            "safe_keep_tags_count": 1,
            "r18_tag_shuffling": True,
            "r18_keep_tags_count": 2,
            "purpose": "production_candidate",
            "allow_promotion": True,
        },
        "entries": entries,
    }
    manifest_path = output / "dataset-manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sheets = build_audit_sheets(output, entries)
    audit_path = write_audit_markdown(output, entries, sheets)
    return manifest_path, audit_path, sheets


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ai-root", type=Path, default=Path(r"E:\code\2\lora\AI"))
    parser.add_argument("--output", type=Path)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    ai_root = args.ai_root.resolve()
    output = (
        args.output.resolve()
        if args.output
        else ai_root / "Datasets" / "Characters" / "Ayachi_Nene" / "V18_Unified"
    )
    manifest, audit, sheets = build(ai_root, output, force=args.force)
    print(
        json.dumps(
            {
                "manifest": str(manifest),
                "audit": str(audit),
                "audit_sheets": [str(sheet) for sheet in sheets],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
