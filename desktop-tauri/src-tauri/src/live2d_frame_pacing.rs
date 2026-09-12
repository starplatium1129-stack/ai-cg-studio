//! Frame pacing has no SDK/GPU dependency, so hidden-window waiting can be tested on office PCs.
use std::sync::mpsc::Receiver;
use std::time::Duration;

pub fn initial_fps(value: Option<&str>) -> u32 {
    value.and_then(|v| v.parse::<u32>().ok()).filter(|f| (1..=1000).contains(f)).unwrap_or(165)
}

pub fn remaining_frame_time(fps: u32, elapsed: Duration) -> Duration {
    Duration::from_micros(1_000_000 / fps.clamp(1, 1000) as u64).saturating_sub(elapsed)
}

pub fn texture_dimensions(width: u32, height: u32, scale: u32) -> (u32, u32) {
    let divisor = if matches!(scale, 2 | 4) { scale } else { 1 };
    ((width / divisor).max(1), (height / divisor).max(1))
}

/// Hidden windows wake for commands immediately, or every 100 ms to pump Win32 messages.
/// Disconnection is handled by the owning loop's existing try_recv/stopped path.
pub fn wait<T>(commands: &Receiver<T>, visible: bool, fps: u32, elapsed: Duration) -> Option<T> {
    if visible {
        std::thread::sleep(remaining_frame_time(fps, elapsed));
        None
    } else {
        commands.recv_timeout(Duration::from_millis(100)).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::channel;
    use std::time::Instant;

    #[test]
    fn active_frame_budget_includes_render_work() {
        assert_eq!(remaining_frame_time(100, Duration::from_millis(4)), Duration::from_millis(6));
        assert_eq!(remaining_frame_time(100, Duration::from_millis(20)), Duration::ZERO);
        assert_eq!(remaining_frame_time(0, Duration::ZERO), Duration::from_secs(1));
    }
    #[test]
    fn preserves_native_quality_and_explicit_fps_override() {
        assert_eq!(initial_fps(None), 165);
        assert_eq!(initial_fps(Some("30")), 30);
        for invalid in ["0", "1001", "-1", "nan"] { assert_eq!(initial_fps(Some(invalid)), 165); }
    }
    #[test]
    fn texture_profiles_preserve_original_and_bound_small_dimensions() {
        assert_eq!(texture_dimensions(8192, 8192, 1), (8192, 8192));
        assert_eq!(texture_dimensions(4096, 4096, 2), (2048, 2048));
        assert_eq!(texture_dimensions(4096, 4096, 4), (1024, 1024));
        assert_eq!(texture_dimensions(1, 3, 4), (1, 1));
        assert_eq!(texture_dimensions(128, 128, 0), (128, 128));
    }
    #[test]
    fn hidden_wait_returns_the_wakeup_command_without_losing_it() {
        let (tx, rx) = channel();
        tx.send("show").unwrap();
        assert_eq!(wait(&rx, false, 165, Duration::ZERO), Some("show"));
    }
    #[test]
    fn hidden_idle_blocks_instead_of_spinning_at_display_rate() {
        let (_tx, rx) = channel::<()>();
        let started = Instant::now();
        assert_eq!(wait(&rx, false, 165, Duration::ZERO), None);
        assert!(started.elapsed() >= Duration::from_millis(80));
    }
    #[test]
    fn disconnected_channel_returns_to_the_owner_for_shutdown() {
        let (tx, rx) = channel::<()>();
        drop(tx);
        assert_eq!(wait(&rx, false, 165, Duration::ZERO), None);
        assert_eq!(rx.try_recv(), Err(std::sync::mpsc::TryRecvError::Disconnected));
    }
}
