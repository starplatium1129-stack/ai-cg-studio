//! 夏目叠层/换装参数回落（overlay settle）模型级闭环测试。
//!
//! 用仓库内真实 natsume moc3 + TapSkirt_0 动作验证换装显隐参数的复位行为。
//! 实测（2026-08-23）：作者曲线在动作尾部把叠层参数动画回隐藏态，但 Cubism 5-r.5
//! 对 Loop 动作的 V2 fade 机制让参数应用（逐帧反馈追赶 × fadeWeight）在动作
//! 自然结束前停在半途（如 Param59 停在 ≈-0.34 而非曲线末值 -1）——旧实现随后
//! 单帧硬写隐藏态，换装部件一帧内消失/回穿，桌宠实机呈现为"闪一下"。
//! begin_overlay_settle 捕获残值后经 smoothstep 缓动回隐藏态。本测试是该
//! 修复的回归守卫。
//!
//! 注意：Cubism 框架全局状态（IdManager/分配器）非线程安全，模型创建必须
//! 串行——两个测试经 FRAMEWORK_LOCK 互斥（正式应用中模型只在单一渲染线
//! 程创建，不存在此约束）。

use live2d_native::model::Model;
use std::sync::{Mutex, MutexGuard, OnceLock};

fn framework_lock() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn natsume_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../assets/live2d/natsume")
}

fn load_natsume_with_tap_skirt() -> Model {
    let dir = natsume_dir();
    let moc = std::fs::read(dir.join("natsume.moc3")).expect("natsume.moc3 readable");
    let model3 = std::fs::read(dir.join("natsume.model3.json")).expect("model3.json readable");
    let mut model = Model::create(&moc, &model3).expect("model create");
    let physics = std::fs::read(dir.join("natsume.physics3.json")).expect("physics3 readable");
    model.load_physics(&physics).expect("physics load");
    let motion =
        std::fs::read(dir.join("motions/TapSkirt_0.motion3.json")).expect("TapSkirt_0 readable");
    model.add_motion("TapSkirt", 0, &motion).expect("add motion");
    model
}

#[test]
fn overlay_settle_eases_costume_params_back_without_single_frame_snap() {
    let _guard = framework_lock();
    let mut model = load_natsume_with_tap_skirt();
    let dt = 1.0 / 60.0;

    // 播放到动作自然结束（1.9s）。作者尾部收回曲线只被 SDK 应用了半程：
    // Param59 停在中途（约 -0.34），远离隐藏态 -1——这正是需要回落补完的
    // 残值，也是旧实现单帧硬写产生"闪一下"的位置。
    let handle = model
        .start_motion("TapSkirt", 0, 3 /* FORCE */)
        .expect("motion start");
    let mut frames = 0;
    while !model.is_finished(handle) {
        model.update(dt);
        frames += 1;
        assert!(frames < 60 * 10, "motion did not finish within 10s of updates");
    }
    let end_value = model.get_parameter("Param59");
    assert!(
        end_value > -0.9,
        "motion must end with overlay param short of hidden state (V2 loop fade stall), got {end_value}"
    );

    // begin 只捕获现值、不写参数；Param59 的隐藏态目标是 -1。
    model.begin_overlay_settle(0.5);
    let captured = model.get_parameter("Param59");
    assert!(
        (captured - end_value).abs() < 1e-5,
        "begin must capture current value without writing: {captured} vs {end_value}"
    );

    // 首帧缓动值贴近残值（对比旧硬写：一帧内跳到 -1）。
    let mut settling = model.step_overlay_settle(dt);
    assert!(settling, "settle must be active after first step");
    let v1 = model.get_parameter("Param59");
    assert!(
        (v1 - end_value).abs() < 0.1,
        "first eased frame must stay near residual value: {v1} vs {end_value}"
    );

    // 全程平滑单调逼近隐藏态；smoothstep(0.5s) 每帧最大位移 = 距离×1.5/T/60，
    // 放宽到 0.2 容忍 dt 累积误差。
    let mut previous = v1;
    let mut steps = 1;
    while settling {
        settling = model.step_overlay_settle(dt);
        let value = model.get_parameter("Param59");
        assert!(
            (value - previous).abs() < 0.2,
            "per-frame movement must stay smooth: {previous} -> {value}"
        );
        assert!(
            value <= previous + 1e-6,
            "must approach hidden state monotonically: {previous} -> {value}"
        );
        previous = value;
        steps += 1;
        assert!(steps < 600, "settle did not finish within 600 steps");
    }
    assert!(steps >= 29, "settle should span ~0.5s at 60fps, got {steps} steps");
    let settled = model.get_parameter("Param59");
    assert!(
        (settled - (-1.0)).abs() < 1e-5,
        "settle must land exactly at hidden state -1, got {settled}"
    );

    // 回落结束后硬性守卫接手，保持隐藏态；非回落期 step 幂等返回 false。
    model.force_overlay_hidden();
    assert!((model.get_parameter("Param59") - (-1.0)).abs() < 1e-5);
    assert!(!model.step_overlay_settle(dt), "step after finish must report inactive");
}

#[test]
fn overlay_settle_from_hidden_state_is_visual_noop() {
    // 参数已在隐藏态时回落零位移、不产生抖动（误触发/幂等场景）。
    let _guard = framework_lock();
    let mut model = load_natsume_with_tap_skirt();
    model.update(1.0 / 60.0);
    let before = model.get_parameter("Param37");
    model.begin_overlay_settle(0.5);
    let mut settling = model.step_overlay_settle(1.0 / 60.0);
    let mut steps = 1;
    while settling {
        settling = model.step_overlay_settle(1.0 / 60.0);
        steps += 1;
        assert!(steps < 600, "settle did not finish");
    }
    let after = model.get_parameter("Param37");
    assert!(
        (after - before).abs() < 1e-5,
        "settle from hidden state must not move params: {before} -> {after}"
    );
}
