/*
 * C API for the native Live2D runtime (Cubism SDK for Native 5-r.5).
 *
 * Thin C++ glue over the official framework so Rust can drive motion playback,
 * expressions, physics, pose, eye blink and hit tests with official behavior.
 */
#ifndef LIVE2D_MODEL_C_API_H
#define LIVE2D_MODEL_C_API_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct l2d_model l2d_model;

/* Motion priorities (framework convention: none=0 idle=1 normal=2 force=3). */
#define L2D_PRIORITY_NONE 0
#define L2D_PRIORITY_IDLE 1
#define L2D_PRIORITY_NORMAL 2
#define L2D_PRIORITY_FORCE 3

/* Blend types as reported by Cubism Core (Live2DCubismCore.h). */
#define L2D_COLOR_BLEND_NORMAL 0
#define L2D_COLOR_BLEND_ADD_COMPATIBLE 1
#define L2D_COLOR_BLEND_MULTIPLY_COMPATIBLE 2
#define L2D_COLOR_BLEND_ADD 3
#define L2D_COLOR_BLEND_ADD_GLOW 4
#define L2D_COLOR_BLEND_DARKEN 5
#define L2D_COLOR_BLEND_MULTIPLY 6
#define L2D_COLOR_BLEND_COLOR_BURN 7
#define L2D_COLOR_BLEND_LINEAR_BURN 8
#define L2D_COLOR_BLEND_LIGHTEN 9
#define L2D_COLOR_BLEND_SCREEN 10
#define L2D_COLOR_BLEND_COLOR_DODGE 11
#define L2D_COLOR_BLEND_OVERLAY 12
#define L2D_COLOR_BLEND_SOFT_LIGHT 13
#define L2D_COLOR_BLEND_HARD_LIGHT 14
#define L2D_COLOR_BLEND_LINEAR_LIGHT 15
#define L2D_COLOR_BLEND_HUE 16
#define L2D_COLOR_BLEND_COLOR 17

#define L2D_ALPHA_BLEND_OVER 0
#define L2D_ALPHA_BLEND_ATOP 1
#define L2D_ALPHA_BLEND_OUT 2
#define L2D_ALPHA_BLEND_CONJOINT_OVER 3
#define L2D_ALPHA_BLEND_DISJOINT_OVER 4

/* 0 on success, nonzero on failure. */
int l2d_initialize(void);
void l2d_terminate(void);

l2d_model* l2d_model_create(const uint8_t* moc_data, size_t moc_size,
                            const uint8_t* model3_data, size_t model3_size);
void l2d_model_destroy(l2d_model* m);

/* Asset loading: call before playback. group/index mirror model3.json order. */
int l2d_model_add_motion(l2d_model* m, const char* group, int index,
                         const uint8_t* json, size_t size);
int l2d_model_add_expression(l2d_model* m, const char* name,
                             const uint8_t* json, size_t size);
int l2d_model_load_physics(l2d_model* m, const uint8_t* json, size_t size);
int l2d_model_load_pose(l2d_model* m, const uint8_t* json, size_t size);

/* Playback. Returns opaque handle (>0) or 0 when the motion could not start. */
int64_t l2d_model_start_motion(l2d_model* m, const char* group, int index, int priority);
int64_t l2d_model_start_expression(l2d_model* m, const char* name, int priority);
void l2d_model_stop_all_motions(l2d_model* m);
int l2d_model_is_finished(l2d_model* m, int64_t handle);
int l2d_model_has_playing_motion(l2d_model* m);

/* Parameters / parts. */
void l2d_model_set_parameter(l2d_model* m, const char* id, float value, float weight);
float l2d_model_get_parameter(l2d_model* m, const char* id);
void l2d_model_set_part_opacity(l2d_model* m, const char* id, float opacity);
float l2d_model_get_part_opacity(l2d_model* m, const char* id);
/* Reset natsume overlay/outfit parameters to author defaults (see cpp). */
void l2d_model_reset_overlay_params(l2d_model* m);
/* Force overlay params to hidden state (per-frame guard while idle). */
void l2d_model_force_overlay_hidden(l2d_model* m);
/* Begin a smooth settle ramp toward the hidden state: captures the current
 * value of every overlay param (typically an authored motion's last values),
 * then l2d_model_step_overlay_settle eases them in over duration_seconds.
 * Replaces the one-frame hard write that made costume parts pop back
 * ("flicker") after interaction motions. duration<=0 falls back to the
 * instant reset. */
void l2d_model_begin_overlay_settle(l2d_model* m, float duration_seconds);
/* Advance the settle ramp after model update; returns 1 while ramping (the
 * caller skips the hard per-frame hidden guard that frame), 0 when finished
 * or inactive. */
int l2d_model_step_overlay_settle(l2d_model* m, float delta_time_seconds);
/* TEMP DIAG: reset every parameter to its moc3 default value. */
void l2d_model_reset_all_parameters(l2d_model* m);

/* Runtime control. */
void l2d_model_set_eye_blink_enabled(l2d_model* m, int enabled);
int l2d_model_get_eye_blink_enabled(l2d_model* m);
void l2d_model_set_opacity(l2d_model* m, float opacity);
void l2d_model_update(l2d_model* m, float delta_time_seconds);

/* Model info. */
float l2d_model_canvas_width(l2d_model* m);
float l2d_model_canvas_height(l2d_model* m);
int l2d_model_parameter_count(l2d_model* m);
int l2d_model_parameter_index(l2d_model* m, const char* id);
int l2d_model_drawable_count(l2d_model* m);
int l2d_model_drawable_index(l2d_model* m, const char* id);

/* Drawable snapshot accessors (pointers valid until the next update call). */
int l2d_model_drawable_vertex_count(l2d_model* m, int index);
const float* l2d_model_drawable_positions(l2d_model* m, int index);
const float* l2d_model_drawable_uvs(l2d_model* m, int index);
const uint16_t* l2d_model_drawable_indices(l2d_model* m, int index);
int l2d_model_drawable_index_count(l2d_model* m, int index);
float l2d_model_drawable_opacity(l2d_model* m, int index);
int l2d_model_drawable_culling(l2d_model* m, int index);
int l2d_model_drawable_texture_index(l2d_model* m, int index);
int l2d_model_drawable_visible(l2d_model* m, int index);
int l2d_model_drawable_render_order(l2d_model* m, int index);
int l2d_model_drawable_color_blend(l2d_model* m, int index);
int l2d_model_drawable_alpha_blend(l2d_model* m, int index);
void l2d_model_drawable_multiply_color(l2d_model* m, int index, float* rgba);
void l2d_model_drawable_screen_color(l2d_model* m, int index, float* rgba);
int l2d_model_drawable_mask_count(l2d_model* m, int index);
const int* l2d_model_drawable_masks(l2d_model* m, int index);
int l2d_model_drawable_inverted_mask(l2d_model* m, int index);

/* Hit test (canvas space, bbox semantics like the official CubismUserModel::IsHit). */
int l2d_model_hit_test(l2d_model* m, const char* hit_area_id, float canvas_x, float canvas_y);

#ifdef __cplusplus
}
#endif

#endif /* LIVE2D_MODEL_C_API_H */
