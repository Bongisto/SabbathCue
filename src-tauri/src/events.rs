pub const EVENT_AUDIO_LEVEL: &str = "audio_level";
pub const EVENT_TRANSCRIPT_PARTIAL: &str = "transcript_partial";
pub const EVENT_TRANSCRIPT_FINAL: &str = "transcript_final";
pub const EVENT_AUDIO_SOURCE_LOST: &str = "audio_source_lost";
pub const EVENT_AUDIO_SOURCE_RECOVERED: &str = "audio_source_recovered";

#[derive(Clone, serde::Serialize)]
pub struct AudioLevelPayload {
    pub rms: f32,
    pub peak: f32,
}

#[derive(Clone, serde::Serialize)]
pub struct WordPayload {
    pub text: String,
    pub start: f64,
    pub end: f64,
    pub confidence: f64,
    pub punctuated: String,
}

#[derive(Clone, serde::Serialize)]
pub struct TranscriptPayload {
    pub text: String,
    pub is_final: bool,
    pub provider: String,
    pub confidence: f64,
    pub words: Vec<WordPayload>,
}
