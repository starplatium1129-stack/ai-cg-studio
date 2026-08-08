//! 路径 B 壳侧：透明 overlay 窗口（WS_EX_LAYERED）+ aics_live2d_* IPC 命令。
//!
//! 契约：src/types/live2dNative.ts + docs/live2d-native-overlay-plan.md。
//! 渲染线程持 wgpu surface（绑定 overlay HWND）+ live2d-native crate 的
//! Model/Renderer；模型只由 setCharacter 创建，动作/表情/口型/情绪/凝视以
//! 意图命令经 channel 交给渲染线程执行（参数级写入由 Cubism Native 完成）。
//! overlay 接收点击（HTCLIENT），WM_LBUTTONDOWN 转归一化坐标 → 渲染线程
//! 用 Cubism HitArea 命中 → `aics:live2d:hit-test` 事件回传（前端改绑
//! onNativeHitTest，DOM 分区只在原生不可用时兜底）。

use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager};
use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
use windows_sys::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetWindowLongPtrW, PeekMessageW, PostQuitMessage,
    RegisterClassExW, SetLayeredWindowAttributes, SetWindowLongPtrW, SetWindowPos, ShowWindow,
    TranslateMessage, DispatchMessageW, WNDCLASSEXW, CS_HREDRAW, CS_VREDRAW, GWLP_USERDATA,
    HTCLIENT, LWA_ALPHA, MSG, PM_REMOVE, SWP_NOACTIVATE, SWP_NOZORDER, SW_HIDE,
    SW_SHOWNA, WM_DESTROY, WM_LBUTTONDOWN, WM_NCHITTEST, WS_EX_LAYERED, WS_EX_NOACTIVATE,
    WS_EX_TOOLWINDOW, WS_POPUP, WINDOW_EX_STYLE, WINDOW_STYLE, CW_USEDEFAULT,
};

use live2d_native::model::{self, Model, ViewTransform};
use live2d_native::renderer::{self, Renderer};

/// overlay 矩形（屏幕物理像素，与 SetWindowPos 一致）。
#[derive(Debug, Clone, Copy, Default)]
pub struct OverlayRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

pub struct Live2DOverlayState {
    pub rect: Mutex<OverlayRect>,
    pub visible: AtomicBool,
    pub opacity: AtomicU32,
    /// HWND 以 isize 存储（HWND = *mut c_void 非 Send）。
    pub hwnd: Mutex<Option<isize>>,
    /// 窗口线程消息循环就绪标记。
    pub window_ready: AtomicBool,
    /// 渲染线程就绪标记：true 后 setCharacter 等命令不再返回 not-attached。
    pub renderer_attached: AtomicBool,
    /// 渲染线程的命令通道。
    pub cmd_tx: Mutex<Option<Sender<OverlayCommand>>>,
    /// 当前加载的角色（口型参数映射等）。
    pub character: Mutex<Option<String>>,
    /// 已渲染帧数（selftest/诊断用）。
    pub frame_count: AtomicU64,
    /// 最近一次 hit-test 结果（selftest 断言用；app=None 时无事件可发）。
    pub hit_test_result: Mutex<Option<Vec<String>>>,
    /// 模型 ready 标记：setCharacter 成功后置 true，前端 onReady 订阅前先查
    /// 此状态（一次性 ready 事件在订阅前发出会丢失，导致前端 connect 超时）。
    pub model_ready: AtomicBool,
}

impl Default for Live2DOverlayState {
    fn default() -> Self {
        Self {
            rect: Mutex::new(OverlayRect::default()),
            visible: AtomicBool::new(false),
            opacity: AtomicU32::new(255),
            hwnd: Mutex::new(None),
            window_ready: AtomicBool::new(false),
            renderer_attached: AtomicBool::new(false),
            cmd_tx: Mutex::new(None),
            character: Mutex::new(None),
            frame_count: AtomicU64::new(0),
            hit_test_result: Mutex::new(None),
            model_ready: AtomicBool::new(false),
        }
    }
}

// ---------------- 命令 ----------------

/// 意图命令：IPC → 渲染线程。带 reply 的等待同步结果；Async 变体由
/// WndProc 发出（点击命中），渲染线程算完直接 emit 事件。
pub enum OverlayCommand {
    SetCharacter {
        character: String,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    PlayMotion {
        group: String,
        index: Option<i64>,
        priority: Option<String>,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    SetExpression {
        name: String,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    SetMouthLevel(f32),
    SetEmotion { name: String, intensity: f32 },
    SetGaze(f32, f32),
    HitTestAsync { x: f32, y: f32 },
    Snapshot {
        path: String,
        reply: tokio::sync::oneshot::Sender<Result<(), String>>,
    },
    Destroy {
        reply: tokio::sync::oneshot::Sender<()>,
    },
}

/// 口型参数映射（浏览器端 MOUTH_PARAMS 的 Rust 侧对应）。
fn mouth_param_for(character: &str) -> &'static str {
    match character {
        "natsume" => "ParamMouthForm3",
        _ => "ParamMouthOpenY",
    }
}

/// 情绪最小执行集：脸红（ParamCheek）+ 眼睛微开合。参数级范围严格受限，
/// 情绪参数表：与浏览器路径 src/utils/emotionRuntime.ts 的
/// NENE_RUNTIME_CONFIG / NATSUME_RUNTIME_CONFIG emotionParams 对齐
/// （值 = 基础强度，最终 = 基础值 × intensity，参数不存在则跳过）。
fn emotion_params(character: &str, name: &str) -> &'static [(&'static str, f32)] {
    match character {
        "natsume" => match name {
            "shy" => &[("ParamCheek", 0.7), ("ParamBrowLY", 0.15), ("ParamBrowRY", 0.15)],
            "happy" => &[("ParamCheek", 0.4), ("ParamBrowLAngle", 0.2), ("ParamBrowRAngle", 0.2)],
            "sad" => &[("ParamBrowLY", -0.3), ("ParamBrowRY", -0.3), ("ParamBrowLForm", 0.3), ("ParamBrowRForm", 0.3)],
            "serious" => &[("ParamBrowLForm", -0.3), ("ParamBrowRForm", -0.3), ("ParamBrowLAngle", -0.25), ("ParamBrowRAngle", -0.25)],
            "gentle" => &[("ParamBrowLY", 0.1), ("ParamBrowRY", 0.1), ("ParamCheek", 0.25)],
            _ => &[],
        },
        _ => match name {
            "shy" => &[("ParamCheek", 0.95), ("ParamCheek5", 1.0), ("ParamEyeLSmile", 0.5), ("ParamEyeRSmile", 0.5), ("ParamBrowLY", 0.25), ("ParamBrowRY", 0.25), ("ParamMouthForm", -0.25)],
            "happy" => &[("ParamCheek1", 0.6), ("ParamEyeLSmile", 0.9), ("ParamEyeRSmile", 0.9), ("ParamBrowLAngle", 0.35), ("ParamBrowRAngle", 0.35), ("ParamMouthForm", 0.8)],
            "sad" => &[("ParamCheek7", 1.0), ("ParamBrowLY", -0.55), ("ParamBrowRY", -0.55), ("ParamBrowLForm", 0.6), ("ParamBrowRForm", 0.6), ("ParamMouthForm", -0.65)],
            "serious" => &[("ParamBrowLForm", -0.5), ("ParamBrowRForm", -0.5), ("ParamBrowLAngle", -0.4), ("ParamBrowRAngle", -0.4), ("ParamMouthForm", -0.4)],
            "gentle" => &[("ParamEyeLSmile", 0.65), ("ParamEyeRSmile", 0.65), ("ParamBrowLY", 0.18), ("ParamBrowRY", 0.18), ("ParamMouthForm", 0.45)],
            _ => &[],
        },
    }
}

/// 逐帧写入情绪表演参数（动作曲线之后覆写，见 step()）。
fn apply_emotion(model: &mut Model, character: &str, name: &str, intensity: f32) {
    let intensity = intensity.clamp(0.0, 1.0);
    for (param, base) in emotion_params(character, name) {
        if model.parameter_index(param).is_some() {
            model.set_parameter(param, base * intensity, 1.0);
        }
    }
}

struct RenderContext {
    instance: wgpu::Instance,
    adapter: wgpu::Adapter,
    device: wgpu::Device,
    queue: wgpu::Queue,
    surface: Option<wgpu::Surface<'static>>,
    surface_format: wgpu::TextureFormat,
    renderer: Option<Renderer>,
    model: Option<Model>,
    textures: Vec<renderer::Texture>,
    mouth_level: f32,
    emotion: Option<(String, f32)>,
    gaze: (f32, f32),
    character: Option<String>,
    hit_area_names: Vec<String>,
    ready_emitted: bool,
    last_rect: OverlayRect,
}

impl RenderContext {
    fn new() -> Result<Self, String> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::DX12,
            flags: Default::default(),
            backend_options: Default::default(),
        });
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            compatible_surface: None,
            force_fallback_adapter: false,
        }))
        .ok_or("no adapter")?;
        eprintln!("[live2d] adapter: {:?} backend={:?}", adapter.get_info().name, adapter.get_info().backend);
        let (device, queue) = pollster::block_on(adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: Some("live2d-overlay"),
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::default(),
                memory_hints: wgpu::MemoryHints::default(),
            },
            None,
        ))
        .map_err(|e| format!("no device: {e}"))?;
        Ok(Self {
            instance,
            adapter,
            device,
            queue,
            surface: None,
            surface_format: wgpu::TextureFormat::Rgba8UnormSrgb,
            renderer: None,
            model: None,
            textures: Vec::new(),
            mouth_level: 0.0,
            emotion: None,
            gaze: (0.0, 0.0),
            character: None,
            hit_area_names: Vec::new(),
            ready_emitted: false,
            last_rect: OverlayRect::default(),
        })
    }

    fn ensure_surface(&mut self, hwnd: HWND) -> Result<(), String> {
        if self.surface.is_some() {
            return Ok(());
        }
        use raw_window_handle::{RawDisplayHandle, RawWindowHandle, Win32WindowHandle, WindowsDisplayHandle};
        use std::num::NonZeroIsize;
        let win32 = Win32WindowHandle::new(NonZeroIsize::new(hwnd as isize).ok_or("hwnd=0")?);
        // 窗口句柄的生命周期由本线程独占保证（窗口线程创建/持有 HWND）。
        let surface = unsafe {
            self.instance
                .create_surface_unsafe(wgpu::SurfaceTargetUnsafe::RawHandle {
                    raw_display_handle: RawDisplayHandle::Windows(WindowsDisplayHandle::new()),
                    raw_window_handle: RawWindowHandle::Win32(win32),
                })
        }
        .map_err(|e| format!("create_surface: {e}"))?;
        let caps = surface.get_capabilities(&self.adapter);
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .or_else(|| caps.formats.first().copied())
            .ok_or("surface has no formats")?;
        self.surface_format = format;
        self.surface = Some(surface);
        self.renderer = Some(Renderer::new(
            Arc::new(self.device.clone()),
            Arc::new(self.queue.clone()),
            self.surface_format,
        ));
        Ok(())
    }

    fn configure_surface(&mut self, width: u32, height: u32) {
        if let Some(surface) = self.surface.as_ref() {
            let _ = surface.configure(
                &self.device,
                &wgpu::SurfaceConfiguration {
                    usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
                    format: self.surface_format,
                    width: width.max(1),
                    height: height.max(1),
                    present_mode: wgpu::PresentMode::AutoVsync,
                    alpha_mode: wgpu::CompositeAlphaMode::Auto,
                    view_formats: vec![],
                    desired_maximum_frame_latency: 2,
                },
            );
        }
    }

    fn load_model(&mut self, assets_root: &std::path::Path, character: &str) -> Result<(), String> {
        let dir = assets_root.join("live2d").join(character);
        if !dir.is_dir() {
            return Err(format!("model dir not found: {}", dir.display()));
        }
        let moc_path = std::fs::read_dir(&dir)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .find(|p| p.extension().map(|e| e == "moc3").unwrap_or(false))
            .ok_or("no .moc3 in model dir")?;
        let stem = moc_path.file_stem().and_then(|s| s.to_str()).unwrap_or("model");
        let model3_path = dir.join("model3.json");
        let model3_path = if model3_path.exists() {
            model3_path
        } else {
            dir.join(format!("{stem}.model3.json"))
        };
        let moc = std::fs::read(&moc_path).map_err(|e| e.to_string())?;
        let model3_bytes = std::fs::read(&model3_path).map_err(|e| e.to_string())?;
        let manifest = model::parse_model3(&model3_bytes)?;

        let mut m = Model::create(&moc, &model3_bytes)?;
        let mut textures: Vec<renderer::Texture> = Vec::new();
        if let Some(refs) = &manifest.file_references {
            if let Some(physics) = &refs.physics {
                let data = std::fs::read(dir.join(physics)).map_err(|e| e.to_string())?;
                m.load_physics(&data)?;
            }
            if let Some(pose) = &refs.pose {
                let data = std::fs::read(dir.join(pose)).map_err(|e| e.to_string())?;
                m.load_pose(&data)?;
            }
            for expr in &refs.expressions {
                let data = std::fs::read(dir.join(&expr.file)).map_err(|e| e.to_string())?;
                m.add_expression(&expr.name, &data)?;
            }
            for (group, motions) in &refs.motions {
                for (idx, mr) in motions.iter().enumerate() {
                    let data = std::fs::read(dir.join(&mr.file)).map_err(|e| e.to_string())?;
                    m.add_motion(group, idx as i32, &data)?;
                }
            }
            let renderer = self.renderer.as_ref().ok_or("renderer not created")?;
            for (ti, tex) in refs.textures.iter().enumerate() {
                let path = dir.join(tex);
                let t0 = Instant::now();
                let img = image::open(&path)
                    .map_err(|e| format!("open texture {}: {e}", path.display()))?
                    .to_rgba8();
                let (w, h) = img.dimensions();
                textures.push(renderer.load_texture(&img.into_raw(), w, h));
                eprintln!("[live2d] texture {}/{} {w}x{h} {:.2}s", ti + 1, refs.textures.len(), t0.elapsed().as_secs_f32());
            }
            if textures.is_empty() {
                return Err("no textures".to_string());
            }
        }
        self.model = Some(m);
        self.textures = textures;
        self.character = Some(character.to_string());
        self.hit_area_names = manifest.hit_areas.iter().map(|h| h.name.clone()).collect();
        Ok(())
    }

    /// 每帧意图应用（口型/情绪/凝视）+ 模型 update。
    fn step(&mut self, dt: f32) {
        let Some(model) = self.model.as_mut() else { return };
        model.update(dt);
        // 覆写参数必须在 UpdateMotion 之后：动作曲线每帧写回参数，
        // 先写会被动作覆盖（实测 TapHead 播放中口型始终为动作姿态）。
        let character = self.character.as_deref().unwrap_or("nene");
        if let Some((name, intensity)) = self.emotion.clone() {
            apply_emotion(model, character, &name, intensity);
        }
        let param = mouth_param_for(character);
        if model.parameter_index(param).is_some() {
            model.set_parameter(param, self.mouth_level, 0.7);
        }
        let (gx, gy) = self.gaze;
        if gx != 0.0 || gy != 0.0 {
            model.set_parameter("ParamAngleX", 30.0 * gx, 0.6);
            model.set_parameter("ParamAngleY", 30.0 * gy, 0.6);
            model.set_parameter("ParamEyeBallX", gx, 0.8);
            model.set_parameter("ParamEyeBallY", gy, 0.8);
        }
    }

    fn render_frame(&mut self, hwnd: HWND, rect: OverlayRect) -> Result<(), String> {
        if rect.width == 0 || rect.height == 0 {
            return Ok(());
        }
        if self.model.is_none() || self.renderer.is_none() {
            return Ok(());
        }
        if self.surface.is_none() {
            self.ensure_surface(hwnd)?;
            self.configure_surface(rect.width, rect.height);
        }
        if self.last_rect.width != rect.width || self.last_rect.height != rect.height {
            self.configure_surface(rect.width, rect.height);
            self.last_rect = rect;
        }
        let surface = self.surface.as_ref().ok_or("no surface")?;
        let frame = match surface.get_current_texture() {
            Ok(frame) => frame,
            Err(wgpu::SurfaceError::Outdated | wgpu::SurfaceError::Lost) => return Ok(()),
            Err(e) => return Err(format!("surface error: {e}")),
        };
        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let model = self.model.as_ref().ok_or("no model")?;
        let renderer = self.renderer.as_mut().ok_or("no renderer")?;
        let bounds = model.content_bounds();
        let transform = ViewTransform::fit_content(bounds, rect.width as f32, rect.height as f32, 0.02);
        let encoder = renderer.draw_frame(
            model,
            &transform,
            &self.textures,
            &view,
            rect.width,
            rect.height,
            false,
            None,
        );
        let _ = self.queue.submit(std::iter::once(encoder.finish()));
        frame.present();
        Ok(())
    }

    /// 归一化坐标（0..1，overlay 相对）→ 作者 HitArea 命中。
    fn hit_test(&self, rect: OverlayRect, nx: f32, ny: f32) -> Vec<String> {
        let Some(model) = self.model.as_ref() else { return vec![] };
        if rect.width == 0 || rect.height == 0 {
            return vec![];
        }
        let bounds = model.content_bounds();
        let transform = ViewTransform::fit_content(bounds, rect.width as f32, rect.height as f32, 0.02);
        let (canvas_x, canvas_y) = transform.screen_to_canvas(
            nx * rect.width as f32,
            ny * rect.height as f32,
            rect.width as f32,
            rect.height as f32,
        );
        // 作者 HitArea id 表：由 setCharacter 时解析 model3.json 缓存。
        // 当前返回命中 id 列表（空 = 未命中或模型未加载）。
        let hit_ids = self.hit_area_ids();
        let mut areas = Vec::new();
        if std::env::var("L2D_DEBUG_HIT").is_ok() {
            eprintln!("[hit] rect={rect:?}");
            eprintln!(
                "[hit] bounds_min={:?} bounds_max={:?} scale={} canvas=({canvas_x:.3},{canvas_y:.3})",
                bounds.0, bounds.1, transform.scale
            );
        }
        for id in &hit_ids {
            if model.hit_test(id, canvas_x, canvas_y) {
                if std::env::var("L2D_DEBUG_HIT").is_ok() {
                    eprintln!("[hit] HIT {id}");
                }
                areas.push(id.clone());
            }
        }
        areas
    }

    /// HitArea 名列表：setCharacter 时从 model3.json HitAreas 动态解析（宁宁/夏目通用），
    /// 空列表 = 模型未加载。
    fn hit_area_ids(&self) -> Vec<String> {
        self.hit_area_names.clone()
    }
}

fn create_overlay_window() -> Option<HWND> {
    unsafe {
        let class_name = "aics_live2d_overlay\0".encode_utf16().collect::<Vec<u16>>();
        let hinstance = GetModuleHandleW(std::ptr::null());
        let wc = WNDCLASSEXW {
            cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
            style: CS_HREDRAW | CS_VREDRAW,
            lpfnWndProc: Some(overlay_wnd_proc),
            cbClsExtra: 0,
            cbWndExtra: 0,
            hInstance: hinstance,
            hIcon: std::ptr::null_mut(),
            hCursor: std::ptr::null_mut(),
            hbrBackground: std::ptr::null_mut(),
            lpszMenuName: std::ptr::null(),
            lpszClassName: class_name.as_ptr(),
            hIconSm: std::ptr::null_mut(),
        };
        if RegisterClassExW(&wc) == 0 {
            let err = windows_sys::Win32::Foundation::GetLastError() as i32;
            if err != 1410 {
                // 1410 = ERROR_CLASS_ALREADY_EXISTS
                return None;
            }
        }
        let hwnd = CreateWindowExW(
            (WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE) as WINDOW_EX_STYLE,
            class_name.as_ptr(),
            "aics-live2d-overlay".encode_utf16().collect::<Vec<u16>>().as_ptr(),
            WS_POPUP as WINDOW_STYLE,
            CW_USEDEFAULT,
            CW_USEDEFAULT,
            1,
            1,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            hinstance,
            std::ptr::null(),
        );
        if hwnd.is_null() {
            return None;
        }
        // 必须让窗口进入"已显示"状态，DXGI 才能枚举 surface 格式；
        // 后续由 SetFrame 用 SetWindowPos 定位 + SW_SHOWNA 真正显示。
        ShowWindow(hwnd, SW_SHOWNA);
        Some(hwnd)
    }
}

extern "system" fn overlay_wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    unsafe {
        match msg {
            WM_NCHITTEST => {
                // overlay 接收点击（角色区域由 Cubism HitArea 判定，事件回传
                // 给前端互动逻辑；点击本身不落到 WebView2，DOM 分区退役）。
                return HTCLIENT as LRESULT;
            }
            WM_LBUTTONDOWN => {
                // 点击 → 归一化坐标 → 异步 hit test → `aics:live2d:hit-test`
                let state_ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA);
                if state_ptr != 0 {
                    let state = &*(state_ptr as *const Live2DOverlayState);
                    if let Some(tx) = state.cmd_tx.lock().unwrap().clone() {
                        let rect = *state.rect.lock().unwrap();
                        if rect.width > 0 && rect.height > 0 {
                            let x = (lparam & 0xFFFF) as i32 as f32 / rect.width as f32;
                            let y = ((lparam >> 16) & 0xFFFF) as i32 as f32 / rect.height as f32;
                            let _ = tx.send(OverlayCommand::HitTestAsync { x, y });
                        }
                    }
                }
                return 0;
            }
            WM_DESTROY => {
                PostQuitMessage(0);
                return 0;
            }
            _ => {}
        }
        DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

/// 渲染线程：消息循环（非阻塞）+ 命令处理 + 帧渲染。
fn overlay_window_thread(
    state: Arc<Live2DOverlayState>,
    assets_root: std::path::PathBuf,
    app: Option<AppHandle>,
) {
    let Some(hwnd) = create_overlay_window() else {
        eprintln!("[live2d] create_overlay_window failed");
        return;
    };
    unsafe {
        SetWindowLongPtrW(
            hwnd,
            GWLP_USERDATA,
            &*state as *const Live2DOverlayState as isize,
        );
    }
    *state.hwnd.lock().unwrap() = Some(hwnd as isize);
    state.window_ready.store(true, Ordering::SeqCst);

    let (tx, rx): (Sender<OverlayCommand>, Receiver<OverlayCommand>) = channel();
    *state.cmd_tx.lock().unwrap() = Some(tx);

    let mut ctx = match RenderContext::new() {
        Ok(ctx) => ctx,
        Err(e) => {
            eprintln!("[live2d] render context init failed: {e}");
            return;
        }
    };
    state.renderer_attached.store(true, Ordering::SeqCst);

    // 目标帧率：默认 165（vsync 由 surface present 决定，165Hz 屏即 165fps），
    // 可用 L2D_TARGET_FPS 覆盖（如 30/60 省电场景）。
    let target_fps = std::env::var("L2D_TARGET_FPS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|f| (1..=1000).contains(f))
        .unwrap_or(165);
    let frame_interval = Duration::from_micros((1_000_000 / target_fps).max(1));

    let mut last_frame = Instant::now();
    let mut running = true;
    while running {
        unsafe {
            let mut msg = std::mem::zeroed::<MSG>();
            while PeekMessageW(&mut msg, std::ptr::null_mut(), 0, 0, PM_REMOVE) > 0 {
                if msg.message == 0x0012 {
                    // WM_QUIT
                    running = false;
                }
                TranslateMessage(&msg);
                DispatchMessageW(&msg);
            }
        }
        loop {
            match rx.try_recv() {
                Ok(cmd) => handle_command(&state, &mut ctx, &assets_root, app.as_ref(), hwnd, cmd),
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => {
                    running = false;
                    break;
                }
            }
        }
        if running && state.visible.load(Ordering::SeqCst) {
            let rect = *state.rect.lock().unwrap();
            let now = Instant::now();
            let dt = (now - last_frame).as_secs_f32().min(0.1);
            last_frame = now;
            ctx.step(dt);
            match ctx.render_frame(hwnd, rect) {
                Ok(()) => {
                    state.frame_count.fetch_add(1, Ordering::Relaxed);
                }
                Err(e) => eprintln!("[live2d] render frame: {e}"),
            }
        }
        thread::sleep(frame_interval);
    }

    *state.hwnd.lock().unwrap() = None;
    state.window_ready.store(false, Ordering::SeqCst);
    state.renderer_attached.store(false, Ordering::SeqCst);
    *state.cmd_tx.lock().unwrap() = None;
}

fn handle_command(
    state: &Arc<Live2DOverlayState>,
    ctx: &mut RenderContext,
    assets_root: &std::path::Path,
    app: Option<&AppHandle>,
    hwnd: HWND,
    cmd: OverlayCommand,
) {
    match cmd {
        OverlayCommand::SetCharacter { character, reply } => {
            let result = (|| {
                ctx.ensure_surface(hwnd)?;
                ctx.load_model(assets_root, &character)
            })();
            if result.is_ok() {
                *state.character.lock().unwrap() = Some(character.clone());
                state.model_ready.store(true, Ordering::SeqCst);
                if !ctx.ready_emitted {
                    ctx.ready_emitted = true;
                    if let Some(app) = app { let _ = app.emit("aics:live2d:ready", ()); }
                }
            }
            let _ = reply.send(result);
        }
        OverlayCommand::PlayMotion { group, index, priority, reply } => {
            let result = (|| -> Result<(), String> {
                let model = ctx.model.as_mut().ok_or("model not loaded")?;
                let priority = match priority.as_deref() {
                    Some("force") => model::PRIORITY_FORCE,
                    Some("normal") => model::PRIORITY_NORMAL,
                    _ => model::PRIORITY_NORMAL,
                };
                let idx = index.unwrap_or(0) as i32;
                model
                    .start_motion(&group, idx, priority)
                    .ok_or_else(|| format!("motion {group}[{idx}] not found"))?;
                Ok(())
            })();
            match &result {
                Ok(()) => {
                    if let Some(app) = app { let _ = app.emit(
                        "aics:live2d:motion-started",
                        serde_json::json!({ "group": group, "index": index }),
                    );
                    }
                }
                Err(reason) => {
                    if let Some(app) = app { let _ = app.emit(
                        "aics:live2d:motion-failed",
                        serde_json::json!({ "group": group, "index": index, "reason": reason }),
                    );
                    }
                }
            }
            let _ = reply.send(result);
        }
        OverlayCommand::SetExpression { name, reply } => {
            let result = (|| -> Result<(), String> {
                let model = ctx.model.as_mut().ok_or("model not loaded")?;
                model
                    .start_expression(&name, model::PRIORITY_FORCE)
                    .ok_or_else(|| format!("expression {name} not found"))?;
                Ok(())
            })();
            let _ = reply.send(result);
        }
        OverlayCommand::SetMouthLevel(level) => {
            ctx.mouth_level = level.clamp(0.0, 1.0);
        }
        OverlayCommand::SetEmotion { name, intensity } => {
            ctx.emotion = Some((name, intensity.clamp(0.0, 1.0)));
        }
        OverlayCommand::SetGaze(x, y) => {
            ctx.gaze = (x.clamp(-1.0, 1.0), y.clamp(-1.0, 1.0));
        }
        OverlayCommand::HitTestAsync { x, y } => {
            let rect = *state.rect.lock().unwrap();
            let areas = ctx.hit_test(rect, x, y);
            *state.hit_test_result.lock().unwrap() = Some(areas.clone());
            if let Some(app) = app { let _ = app.emit("aics:live2d:hit-test", serde_json::json!({ "areas": areas })); }
        }
        OverlayCommand::Snapshot { path, reply } => {
            let result = (|| -> Result<(), String> {
                let model = ctx.model.as_mut().ok_or("model not loaded")?;
                let renderer = ctx.renderer.as_mut().ok_or("renderer not created")?;
                let bounds = model.content_bounds();
                let transform = ViewTransform::fit_content(bounds, 800.0, 800.0, 0.02);
                let pixels = renderer.render_to_image(model, &transform, &ctx.textures, 800, 800, false, None);
                let img = image::RgbaImage::from_raw(800, 800, pixels).ok_or("snapshot: bad rgba")?;
                img.save(&path).map_err(|e| format!("snapshot save: {e}"))?;
                Ok(())
            })();
            let _ = reply.send(result);
        }
        OverlayCommand::Destroy { reply } => {
            ctx.model = None;
            ctx.textures.clear();
            let _ = reply.send(());
        }
    }
}

// ---------------- 公开 API ----------------

/// 启动 overlay 窗口 + 渲染线程（幂等）。
/// 渲染链路自测：无 Tauri 依赖，直接创建 overlay → 加载模型 → 渲染数帧 → 退出。
/// 供 LIVE2D_SELFTEST=1 环境变量驱动，验证窗口/wgpu/模型/渲染循环全链路。
pub fn selftest(assets_root: std::path::PathBuf) -> Result<(), String> {
    let state = Arc::new(Live2DOverlayState::default());
    let handle = state.clone();
    thread::spawn(move || overlay_window_thread(handle, assets_root, None));
    let deadline = Instant::now() + Duration::from_secs(15);
    while !state.window_ready.load(Ordering::SeqCst) {
        if Instant::now() > deadline {
            return Err("selftest: overlay window not ready within 15s".into());
        }
        thread::sleep(Duration::from_millis(50));
    }
    let tx = state
        .cmd_tx
        .lock()
        .unwrap()
        .clone()
        .ok_or("selftest: no cmd channel")?;
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    tx.send(OverlayCommand::SetCharacter {
        character: "nene".to_string(),
        reply: reply_tx,
    })
    .map_err(|e| format!("selftest: send set_character: {e}"))?;
    let reply = reply_rx
        .blocking_recv()
        .map_err(|e| format!("selftest: reply channel closed: {e}"))?;
    reply.map_err(|e| format!("selftest: set_character failed: {e}"))?;
    *state.rect.lock().unwrap() = OverlayRect { x: 200, y: 200, width: 800, height: 800 };
    state.visible.store(true, Ordering::SeqCst);

    let mut check = |label: &str, result: Result<Result<(), String>, String>| -> Result<(), String> {
        let inner = result.map_err(|e| format!("selftest: {label} channel error: {e}"))?;
        inner.map_err(|e| format!("selftest: {label} failed: {e}"))
    };

    let cmd = |c: OverlayCommand, timeout_ms: u64| -> Result<Result<(), String>, String> {
        let (r_tx, mut r_rx) = tokio::sync::oneshot::channel::<Result<(), String>>();
        let c = match c {
            OverlayCommand::SetCharacter { character, .. } => {
                OverlayCommand::SetCharacter { character, reply: r_tx }
            }
            OverlayCommand::PlayMotion { group, index, priority, .. } => {
                OverlayCommand::PlayMotion { group, index, priority, reply: r_tx }
            }
            OverlayCommand::Snapshot { path, .. } => OverlayCommand::Snapshot { path, reply: r_tx },
            _other => {
                return Err(format!("selftest: unsupported reply command"));
            }
        };
        let tx = state.cmd_tx.lock().unwrap().clone().ok_or("selftest: no cmd channel")?;
        tx.send(c).map_err(|e| format!("selftest: send failed: {e}"))?;
        let deadline = Instant::now() + Duration::from_millis(timeout_ms);
        loop {
            if let Ok(r) = r_rx.try_recv() {
                return Ok(r);
            }
            if Instant::now() > deadline {
                return Err("selftest: reply timeout".into());
            }
            thread::sleep(Duration::from_millis(20));
        }
    };

    let out_dir = std::env::var("LIVE2D_SNAPSHOT_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::path::PathBuf::from("."));

    check(
        "nene play_motion TapHead",
        cmd(
            OverlayCommand::PlayMotion {
                group: "TapHead".into(),
                index: Some(0),
                priority: Some("force".into()),
                reply: tokio::sync::oneshot::channel().0,
            },
            5000,
        ),
    )?;
    thread::sleep(Duration::from_millis(800));
    check(
        "nene snapshot",
        cmd(
            OverlayCommand::Snapshot {
                path: out_dir.join("selftest-nene-motion.png").to_string_lossy().to_string(),
                reply: tokio::sync::oneshot::channel().0,
            },
            15000,
        ),
    )?;

    tx.send(OverlayCommand::SetMouthLevel(0.8)).map_err(|e| format!("selftest: send mouth: {e}"))?;
    tx.send(OverlayCommand::SetEmotion {
        name: "happy".into(),
        intensity: 1.0,
    })
    .map_err(|e| format!("selftest: send emotion: {e}"))?;
    thread::sleep(Duration::from_millis(500));
    check(
        "nene snapshot mouth+emotion",
        cmd(
            OverlayCommand::Snapshot {
                path: out_dir.join("selftest-nene-mouth.png").to_string_lossy().to_string(),
                reply: tokio::sync::oneshot::channel().0,
            },
            15000,
        ),
    )?;

    tx.send(OverlayCommand::HitTestAsync { x: 0.5, y: 0.11 }).map_err(|e| format!("selftest: send hit test: {e}"))?;
    thread::sleep(Duration::from_millis(300));
    let areas = state.hit_test_result.lock().unwrap().clone();
    match areas {
        Some(areas) if !areas.is_empty() => {
            println!("LIVE2D_SELFTEST_HITTEST areas={areas:?}");
        }
        Some(_) => return Err("selftest: hit test returned empty areas (expected Face hit)".into()),
        None => return Err("selftest: hit test produced no result".into()),
    }

    check(
        "natsume set_character",
        cmd(
            OverlayCommand::SetCharacter {
                character: "natsume".into(),
                reply: tokio::sync::oneshot::channel().0,
            },
            120000,
        ),
    )?;
    check(
        "natsume play_motion Start",
        cmd(
            OverlayCommand::PlayMotion {
                group: "Start".into(),
                index: Some(0),
                priority: Some("force".into()),
                reply: tokio::sync::oneshot::channel().0,
            },
            5000,
        ),
    )?;
    thread::sleep(Duration::from_millis(800));
    check(
        "natsume snapshot",
        cmd(
            OverlayCommand::Snapshot {
                path: out_dir.join("selftest-natsume.png").to_string_lossy().to_string(),
                reply: tokio::sync::oneshot::channel().0,
            },
            15000,
        ),
    )?;

    thread::sleep(Duration::from_secs(1));
    let frames = state.frame_count.load(Ordering::SeqCst);
    *state.cmd_tx.lock().unwrap() = None;
    if frames == 0 {
        return Err(format!("selftest: no frames rendered (frame_count={frames})"));
    }
    println!("LIVE2D_SELFTEST_OK frames={frames}");
    Ok(())
}
pub fn ensure_overlay(app: &AppHandle, assets_root: std::path::PathBuf) -> Arc<Live2DOverlayState> {
    if let Some(state) = app.try_state::<Arc<Live2DOverlayState>>() {
        let state = state.inner().clone();
        if !state.window_ready.load(Ordering::SeqCst) {
            let handle = state.clone();
            let assets = assets_root.clone();
            let app2 = app.clone();
            thread::spawn(move || overlay_window_thread(handle, assets, Some(app2)));
        }
        return state;
    }
    let state = Arc::new(Live2DOverlayState::default());
    let handle = state.clone();
    let app2 = app.clone();
    thread::spawn(move || overlay_window_thread(handle, assets_root, Some(app2)));
    app.manage(state.clone());
    state
}

/// setFrame：定位 + 显隐 + 透明度（屏幕物理像素）。
pub fn apply_frame(
    app: &AppHandle,
    rect: OverlayRect,
    visible: bool,
    opacity: Option<u32>,
) -> Result<(), String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(app, assets_root);
    let deadline = Instant::now() + Duration::from_secs(1);
    while !state.window_ready.load(Ordering::SeqCst) && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(10));
    }
    let Some(hwnd) = state.hwnd.lock().unwrap().clone().map(|h| h as HWND) else {
        return Err("overlay window not ready".to_string());
    };
    *state.rect.lock().unwrap() = rect;
    state.visible.store(visible, Ordering::SeqCst);
    let alpha = opacity.unwrap_or(255).min(255);
    state.opacity.store(alpha, Ordering::SeqCst);
    unsafe {
        SetLayeredWindowAttributes(hwnd, 0, alpha as u8, LWA_ALPHA);
        if visible {
            SetWindowPos(
                hwnd,
                std::ptr::null_mut(),
                rect.x,
                rect.y,
                rect.width as i32,
                rect.height as i32,
                SWP_NOACTIVATE | SWP_NOZORDER,
            );
            ShowWindow(hwnd, SW_SHOWNA);
        } else {
            ShowWindow(hwnd, SW_HIDE);
        }
    }
    Ok(())
}

/// 发送意图命令并等待渲染线程接收（IPC 同步命令的通道建立）。
fn send_command(state: &Arc<Live2DOverlayState>, cmd: OverlayCommand) -> Result<(), String> {
    let deadline = Instant::now() + Duration::from_secs(2);
    loop {
        let tx = state.cmd_tx.lock().unwrap().clone();
        if let Some(tx) = tx {
            tx.send(cmd)
                .map_err(|_| "renderer thread disconnected".to_string())?;
            return Ok(());
        }
        if Instant::now() > deadline {
            return Err("renderer not attached".to_string());
        }
        thread::sleep(Duration::from_millis(20));
    }
}

// ---------------- IPC 命令（aics_live2d_*） ----------------

#[tauri::command]
pub fn aics_live2d_set_character(
    app: AppHandle,
    model_path: String,
    character: Option<String>,
) -> Result<serde_json::Value, String> {
    // 白名单：character 只接受已知角色；model_path 忽略（资产由 Rust 从
    // assets_root/live2d/{character} 读取，不接收任意路径）。
    let character = character.unwrap_or_else(|| "nene".to_string());
    if !matches!(character.as_str(), "nene" | "natsume") {
        return Ok(serde_json::json!({ "ok": false, "error": format!("unknown character {character}") }));
    }
    let _ = model_path;
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    let (tx, rx) = tokio::sync::oneshot::channel();
    send_command(
        &state,
        OverlayCommand::SetCharacter {
            character,
            reply: tx,
        },
    )?;
    let result = pollster::block_on(rx).map_err(|_| "renderer dropped command".to_string())?;
    match result {
        Ok(()) => Ok(serde_json::json!({ "ok": true })),
        Err(e) => Ok(serde_json::json!({ "ok": false, "error": e })),
    }
}

#[tauri::command]
pub fn aics_live2d_set_frame(
    app: AppHandle,
    rect: serde_json::Value,
    visible: bool,
    opacity: Option<f64>,
) -> Result<(), String> {
    let obj = rect.as_object().ok_or("rect must be an object")?;
    let x = obj.get("x").and_then(|v| v.as_i64()).ok_or("rect.x")? as i32;
    let y = obj.get("y").and_then(|v| v.as_i64()).ok_or("rect.y")? as i32;
    let width = obj.get("width").and_then(|v| v.as_u64()).ok_or("rect.width")? as u32;
    let height = obj.get("height").and_then(|v| v.as_u64()).ok_or("rect.height")? as u32;
    apply_frame(
        &app,
        OverlayRect { x, y, width, height },
        visible,
        opacity.map(|o| (o.clamp(0.0, 1.0) * 255.0) as u32),
    )
}

/// 状态查询：前端 onReady 订阅前先查 model_ready（ready 事件在订阅前发出会
/// 丢失——connect 里先 await setCharacter 后订阅，事件时序导致前端超时）。
#[tauri::command]
pub fn aics_live2d_get_state(app: AppHandle) -> Result<serde_json::Value, String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    Ok(serde_json::json!({
        "ready": state.model_ready.load(Ordering::SeqCst),
        "windowReady": state.window_ready.load(Ordering::SeqCst),
        "rendererAttached": state.renderer_attached.load(Ordering::SeqCst),
        "character": state.character.lock().unwrap().clone(),
    }))
}

#[tauri::command]
pub fn aics_live2d_play_motion(
    app: AppHandle,
    group: String,
    index: Option<i64>,
    priority: Option<String>,
) -> Result<serde_json::Value, String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    let (tx, rx) = tokio::sync::oneshot::channel();
    send_command(
        &state,
        OverlayCommand::PlayMotion {
            group,
            index,
            priority,
            reply: tx,
        },
    )?;
    let result = pollster::block_on(rx).map_err(|_| "renderer dropped command".to_string())?;
    match result {
        Ok(()) => Ok(serde_json::json!({ "ok": true })),
        Err(e) => Ok(serde_json::json!({ "ok": false, "error": e })),
    }
}

#[tauri::command]
pub fn aics_live2d_set_expression(
    app: AppHandle,
    name: String,
) -> Result<serde_json::Value, String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    let (tx, rx) = tokio::sync::oneshot::channel();
    send_command(&state, OverlayCommand::SetExpression { name, reply: tx })?;
    let result = pollster::block_on(rx).map_err(|_| "renderer dropped command".to_string())?;
    match result {
        Ok(()) => Ok(serde_json::json!({ "ok": true })),
        Err(e) => Ok(serde_json::json!({ "ok": false, "error": e })),
    }
}

#[tauri::command]
pub fn aics_live2d_set_mouth_level(app: AppHandle, level: f64) -> Result<(), String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    send_command(&state, OverlayCommand::SetMouthLevel(level as f32))
}

#[tauri::command]
pub fn aics_live2d_set_emotion(app: AppHandle, name: String, intensity: f64) -> Result<(), String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    send_command(
        &state,
        OverlayCommand::SetEmotion {
            name,
            intensity: intensity as f32,
        },
    )
}

#[tauri::command]
pub fn aics_live2d_set_gaze(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    send_command(&state, OverlayCommand::SetGaze(x as f32, y as f32))
}

#[tauri::command]
pub fn aics_live2d_hit_test(
    app: AppHandle,
    x: f64,
    y: f64,
) -> Result<serde_json::Value, String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    // 显式查询：点击路径已走 HitTestAsync 事件；这里同样发异步命令，
    // 命中结果统一经 `aics:live2d:hit-test` 事件回传（前端以事件为准）。
    send_command(
        &state,
        OverlayCommand::HitTestAsync { x: x as f32, y: y as f32 },
    )?;
    Ok(serde_json::json!({ "areas": [] }))
}

#[tauri::command]
pub fn aics_live2d_destroy(app: AppHandle) -> Result<(), String> {
    let assets_root = app.state::<crate::paths::DesktopPaths>().assets_root.clone();
    let state = ensure_overlay(&app, assets_root);
    let (tx, rx) = tokio::sync::oneshot::channel();
    send_command(&state, OverlayCommand::Destroy { reply: tx })?;
    let _ = pollster::block_on(rx);
    if let Some(hwnd) = state.hwnd.lock().unwrap().clone().map(|h| h as HWND) {
        unsafe {
            ShowWindow(hwnd, SW_HIDE);
        }
    }
    state.visible.store(false, Ordering::SeqCst);
    Ok(())
}
