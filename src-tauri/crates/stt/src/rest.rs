//! Deepgram REST API fallback for when WebSocket connection is unreliable.
//!
//! Buffers audio and periodically POSTs to the Deepgram REST endpoint.
//! Produces the same `TranscriptEvent` types as the WebSocket client.

use std::time::Duration;

use crate::deepgram::{append_deepgram_base_query, append_deepgram_keyterms};
use crate::error::SttError;
use crate::types::{SttConfig, TranscriptEvent, Word};

const REST_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REST_REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

pub struct DeepgramRestClient {
    config: SttConfig,
    client: reqwest::Client,
}

fn build_http_client() -> Result<reqwest::Client, SttError> {
    reqwest::Client::builder()
        .connect_timeout(REST_CONNECT_TIMEOUT)
        .timeout(REST_REQUEST_TIMEOUT)
        .build()
        .map_err(|e| SttError::ConnectionFailed(format!("Failed to build REST client: {e}")))
}

impl DeepgramRestClient {
    pub fn try_new(config: SttConfig) -> Result<Self, SttError> {
        Ok(Self {
            config,
            client: build_http_client()?,
        })
    }

    pub fn new(config: SttConfig) -> Self {
        let client = build_http_client().unwrap_or_else(|e| {
            log::warn!("[STT-REST] Falling back to default reqwest client: {e}");
            reqwest::Client::new()
        });
        Self { config, client }
    }

    /// Transcribe a chunk of raw PCM audio (i16 LE samples, mono, 16kHz).
    ///
    /// Sends the audio to Deepgram's REST endpoint and returns transcript events.
    /// Unlike the WebSocket client, this is request/response — no streaming.
    #[expect(
        clippy::cast_precision_loss,
        reason = "audio sample count fits comfortably in f64"
    )]
    pub async fn transcribe(&self, samples: &[i16]) -> Result<Vec<TranscriptEvent>, SttError> {
        if self.config.api_key.trim().is_empty() {
            return Err(SttError::ApiKeyMissing);
        }
        if self
            .config
            .api_key
            .bytes()
            .any(|b| b == b'\r' || b == b'\n' || b == 0)
        {
            return Err(SttError::ConnectionFailed(
                "Invalid Deepgram API key header".to_string(),
            ));
        }
        if samples.is_empty() {
            return Ok(vec![]);
        }

        // Convert i16 samples to raw bytes (little-endian)
        let mut audio_bytes: Vec<u8> = Vec::with_capacity(samples.len() * 2);
        for sample in samples {
            audio_bytes.extend_from_slice(&sample.to_le_bytes());
        }

        let url = build_rest_url(&self.config)?;

        let started = std::time::Instant::now();
        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Token {}", self.config.api_key))
            .header("Content-Type", "application/octet-stream")
            .body(audio_bytes)
            .send()
            .await
            .map_err(|e| SttError::ConnectionFailed(format!("REST request failed: {e}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(SttError::ConnectionFailed(format!(
                "Deepgram REST API error {status}: {body}"
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| SttError::ParseError(format!("Failed to parse REST response: {e}")))?;
        log::info!(
            "[STT-REST] Transcribed {:.1}s audio in {:?}",
            samples.len() as f64 / f64::from(self.config.sample_rate),
            started.elapsed()
        );

        Ok(parse_rest_transcript_events(&json))
    }
}

fn parse_rest_transcript_events(json: &serde_json::Value) -> Vec<TranscriptEvent> {
    // REST response wraps everything in "results.channels[0].alternatives[0]"
    let mut events = Vec::new();

    let Some(channels) = json
        .get("results")
        .and_then(|r| r.get("channels"))
        .and_then(|c| c.as_array())
    else {
        return events;
    };

    for channel in channels {
        let Some(first) = channel
            .get("alternatives")
            .and_then(|a| a.as_array())
            .and_then(|alts| alts.first())
        else {
            continue;
        };

        let transcript = first
            .get("transcript")
            .and_then(|t| t.as_str())
            .unwrap_or("")
            .to_string();
        if transcript.is_empty() {
            continue;
        }

        let confidence = first
            .get("confidence")
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(0.0);

        let words = first
            .get("words")
            .and_then(|w| w.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|w| {
                        // Keep words whose optional fields are missing;
                        // dropping the whole word desynchronized the confidence timeline.
                        let text = w.get("word")?.as_str()?.to_string();
                        Some(Word {
                            text,
                            start: w
                                .get("start")
                                .and_then(serde_json::Value::as_f64)
                                .unwrap_or(0.0),
                            end: w
                                .get("end")
                                .and_then(serde_json::Value::as_f64)
                                .unwrap_or(0.0),
                            confidence: w
                                .get("confidence")
                                .and_then(serde_json::Value::as_f64)
                                .unwrap_or(0.0),
                            punctuated_word: w
                                .get("punctuated_word")
                                .and_then(|p| p.as_str())
                                .map(ToString::to_string),
                        })
                    })
                    .collect::<Vec<Word>>()
            })
            .unwrap_or_default();

        events.push(TranscriptEvent::Final {
            transcript,
            words,
            confidence,
            speech_final: true,
        });
    }

    events
}

pub(crate) fn build_rest_url(config: &SttConfig) -> Result<url::Url, SttError> {
    let mut url = url::Url::parse("https://api.deepgram.com/v1/listen")
        .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;
    {
        let mut q = url.query_pairs_mut();
        append_deepgram_base_query(&mut q, config);
        append_deepgram_keyterms(&mut q, config.language.as_deref());
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rest_url_uses_same_accuracy_params_as_streaming_base() {
        let url = build_rest_url(&SttConfig {
            api_key: "test".into(),
            model: "nova-3".into(),
            sample_rate: 16_000,
            encoding: "linear16".into(),
            language: Some("en".into()),
        })
        .unwrap();
        let pairs = url.query_pairs().collect::<Vec<_>>();

        assert!(pairs.contains(&("model".into(), "nova-3".into())));
        assert!(pairs.contains(&("encoding".into(), "linear16".into())));
        assert!(pairs.contains(&("sample_rate".into(), "16000".into())));
        assert!(pairs.contains(&("channels".into(), "1".into())));
        assert!(pairs.contains(&("punctuate".into(), "true".into())));
        assert!(pairs.contains(&("smart_format".into(), "true".into())));
        assert!(pairs.contains(&("numerals".into(), "true".into())));
        assert!(pairs.contains(&("language".into(), "en".into())));
        assert!(pairs.contains(&("keyterm".into(), "Jesus".into())));
    }

    #[test]
    fn try_new_builds_client_with_timeouts() {
        let client = DeepgramRestClient::try_new(SttConfig {
            api_key: "test".into(),
            ..SttConfig::default()
        });
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn transcribe_rejects_empty_and_control_char_api_keys() {
        let missing = DeepgramRestClient::try_new(SttConfig {
            api_key: "   ".into(),
            ..SttConfig::default()
        })
        .unwrap();
        assert!(matches!(
            missing.transcribe(&[1, 2, 3]).await,
            Err(SttError::ApiKeyMissing)
        ));

        let bad_header = DeepgramRestClient::try_new(SttConfig {
            api_key: "bad\nkey".into(),
            ..SttConfig::default()
        })
        .unwrap();
        assert!(matches!(
            bad_header.transcribe(&[1, 2, 3]).await,
            Err(SttError::ConnectionFailed(msg)) if msg.contains("API key")
        ));
    }
}
