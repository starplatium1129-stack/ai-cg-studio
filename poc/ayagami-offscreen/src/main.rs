//! Render a Live2D model with the reference ayagami renderer (pure Rust,
//! wgpu) offscreen and save a PNG. This is the ground-truth output to
//! compare our native-live2d renderer against.
//!
//! Usage: ayagami-offscreen <model3.json> <out.png> [width] [height] [frame]

use std::fs::File;
use std::io::Read;
use std::sync::Arc;

use ayagami::file;
use ayagami::core::{ArtMesh as _, Item as _, Model as _};
use ayagami_render::{ModelRenderer, RenderColorspace, RenderOptions};
use glam::f32::vec2;
use glam::Affine2;
use glam::u32::uvec2;

fn load_model(model3_path: &str) -> (file::ParsedModel, Vec<Vec<u8>>) {
    let json = std::fs::read(model3_path).expect("read model3.json");
    let manifest: serde_json::Value = serde_json::from_slice(&json).expect("parse model3.json");
    let base = std::path::Path::new(model3_path).parent().unwrap().to_path_buf();
    let refs = &manifest["FileReferences"];
    let moc = base.join(refs["Moc"].as_str().unwrap());
    let mut f = File::open(&moc).expect("open moc3");
    let model = file::ParsedModel::load(&mut f).expect("parse moc3");
    let mut textures = Vec::new();
    for tex in refs["Textures"].as_array().unwrap() {
        let path = base.join(tex.as_str().unwrap());
        let mut data = Vec::new();
        File::open(&path).expect("open texture").read_to_end(&mut data).unwrap();
        textures.push(data);
    }
    (model, textures)
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let model3 = args.get(1).expect("usage: ayagami-offscreen <model3.json> <out.png> [w] [h]").clone();
    let out = args.get(2).expect("out.png").clone();
    let width: u32 = args.get(3).and_then(|v| v.parse().ok()).unwrap_or(512);
    let height: u32 = args.get(4).and_then(|v| v.parse().ok()).unwrap_or(512);

    let (model, texdata) = load_model(&model3);
    println!("loaded");
    let mut counts: Vec<(String, u32)> = Vec::new();
    for am in model.artmeshes() {
        counts.push((am.id().to_string(), am.vertex_count()));
    }
    counts.sort_by(|a, b| a.0.cmp(&b.0));
    for (id, vc) in counts.iter().take(200) {
        println!("[ayagami-vc] {id} {vc}");
    }
    let canvas = model.canvas_properties();
    println!(
        "canvas: scale={} center=({},{}) dims=({},{})",
        canvas.scale, canvas.center.x, canvas.center.y, canvas.dimensions.x, canvas.dimensions.y
    );

    let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::PRIMARY,
            flags: Default::default(),
            memory_budget_thresholds: Default::default(),
            backend_options: Default::default(),
            display: None,
        });
    let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
        power_preference: wgpu::PowerPreference::HighPerformance,
        compatible_surface: None,
        force_fallback_adapter: false,
    }))
    .expect("adapter");
    let (device, queue) = pollster::block_on(adapter.request_device(
        &wgpu::DeviceDescriptor {
            label: None,
            required_features: wgpu::Features::empty(),
            experimental_features: wgpu::ExperimentalFeatures::disabled(),
            required_limits: wgpu::Limits::default(),
            memory_hints: Default::default(),
            trace: wgpu::Trace::Off,
        },
    ))
    .expect("device");

    let mut renderer = ModelRenderer::new(device.clone(), queue.clone()).expect("renderer");
    let model = Arc::new(model);
    let textures: Vec<&[u8]> = texdata.iter().map(|v| &v[..]).collect();
    renderer.load_model(model, &textures).expect("load model");

    let format = wgpu::TextureFormat::Rgba8UnormSrgb;
    let target = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("target"),
        size: wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format,
        usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::COPY_SRC,
        view_formats: &[],
    });
    let view = target.create_view(&wgpu::TextureViewDescriptor::default());

    let mut encoder = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    let attachment = wgpu::RenderPassColorAttachment {
        view: &view,
        resolve_target: None,
        ops: wgpu::Operations {
            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
            store: wgpu::StoreOp::Store,
        },
        depth_slice: None,
    };

    // Fit like the demo: uniform scale based on aspect ratio
    let dims_v = uvec2(width, height).as_vec2();
    let mut scale = if dims_v.x > dims_v.y {
        vec2(dims_v.y / dims_v.x, 1.0)
    } else {
        vec2(1.0, dims_v.x / dims_v.y)
    };
    scale *= vec2(1.0, 1.0);
    let opts = RenderOptions {
        transform: Affine2::from_scale(scale),
        mask_dimensions: uvec2(width, height),
        colorspace: RenderColorspace::Linear,
    };

    renderer.prepare(&mut encoder, &opts);
    {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("main"),
            color_attachments: &[Some(attachment)],
            depth_stencil_attachment: None,
            occlusion_query_set: None,
            timestamp_writes: None,
            multiview_mask: None,
        });
        renderer.render(&mut pass, format);
    }
    queue.submit(std::iter::once(encoder.finish()));

    // read back
    let readback = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("readback"),
        size: (width as u64) * (height as u64) * 4,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });
    let mut enc2 = device.create_command_encoder(&wgpu::CommandEncoderDescriptor::default());
    enc2.copy_texture_to_buffer(
        wgpu::TexelCopyTextureInfo {
            texture: &target,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        wgpu::TexelCopyBufferInfo {
            buffer: &readback,
            layout: wgpu::TexelCopyBufferLayout {
                offset: 0,
                bytes_per_row: Some(width * 4),
                rows_per_image: Some(height),
            },
        },
        wgpu::Extent3d {
            width,
            height,
            depth_or_array_layers: 1,
        },
    );
    queue.submit(std::iter::once(enc2.finish()));
    let slice = readback.slice(..);
    let (tx, rx) = std::sync::mpsc::channel();
    slice.map_async(wgpu::MapMode::Read, move |r| {
        let _ = tx.send(r);
    });
    device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None });
    rx.recv().unwrap().unwrap();
    let data = slice.get_mapped_range().to_vec();

    let img = image::RgbaImage::from_raw(width, height, data).expect("rgba");
    img.save(&out).expect("save png");
    println!("saved {out}");
}
