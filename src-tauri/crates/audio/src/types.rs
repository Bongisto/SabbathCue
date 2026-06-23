use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    pub sample_rate: u32,
    pub channels: u16,
    pub is_default: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct AudioConfig {
    pub device_id: Option<String>,
    pub sample_rate: u32,
    pub gain: f32,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
pub struct AudioFrame {
    pub samples: Vec<i16>,
    pub timestamp_ms: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct AudioLevel {
    pub rms: f32,
    pub peak: f32,
}

pub type GainHandle = Arc<AtomicU32>;

fn normalize_gain(gain: f32) -> f32 {
    if gain.is_finite() {
        gain.clamp(0.0, 2.0)
    } else {
        1.0
    }
}

pub fn new_gain_handle(gain: f32) -> GainHandle {
    Arc::new(AtomicU32::new(normalize_gain(gain).to_bits()))
}

pub fn set_gain(handle: &GainHandle, gain: f32) {
    handle.store(normalize_gain(gain).to_bits(), Ordering::Relaxed);
}

pub fn read_gain(handle: &GainHandle) -> f32 {
    normalize_gain(f32::from_bits(handle.load(Ordering::Relaxed)))
}
