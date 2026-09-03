use std::fmt;

/// Lỗi khi đọc / parse cấu hình launcher.
#[derive(Debug, PartialEq)]
pub enum ConfigError {
    MissingField,
    InvalidScheme,
    JsonParse(String),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::MissingField => write!(f, "config: thiếu trường 'url'"),
            ConfigError::InvalidScheme => {
                write!(f, "config: url phải là http:// hoặc https:// (và không chứa dấu nháy)")
            }
            ConfigError::JsonParse(e) => write!(f, "config: JSON không hợp lệ: {}", e),
        }
    }
}

/// Parse và validate URL từ nội dung file config.json.
///
/// Bảo mật:
/// - Chỉ chấp nhận scheme `http://` hoặc `https://` (chặn `file://`,
///   `javascript:`, `data:`... để tránh local file disclosure / XSS qua config).
/// - Từ chối chuỗi chứa dấu nháy đơn/kép để tránh chèn script khi inject
///   vào `window.__GARAGE_URL__` ở phía webview (defense-in-depth).
pub fn parse_config(content: &str) -> Result<String, ConfigError> {
    // Windows editors (Notepad / PowerShell -Encoding UTF8) thường lưu file
    // kèm BOM (EF BB BF); serde_json từ chối BOM -> strip trước khi parse.
    let content = content.trim_start_matches('\u{feff}');

    let v: serde_json::Value =
        serde_json::from_str(content).map_err(|e| ConfigError::JsonParse(e.to_string()))?;

    let url = v
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or(ConfigError::MissingField)?;

    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err(ConfigError::InvalidScheme);
    }
    if url.contains('\'') || url.contains('"') {
        return Err(ConfigError::InvalidScheme);
    }

    Ok(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_http() {
        assert_eq!(
            parse_config(r#"{"url":"http://garage.local"}"#).unwrap(),
            "http://garage.local"
        );
    }

    #[test]
    fn valid_https_with_port() {
        assert_eq!(
            parse_config(r#"{"url":"https://192.168.1.10:8443"}"#).unwrap(),
            "https://192.168.1.10:8443"
        );
    }

    #[test]
    fn missing_field() {
        assert_eq!(parse_config(r#"{"foo":1}"#), Err(ConfigError::MissingField));
    }

    #[test]
    fn rejects_file_scheme() {
        assert_eq!(
            parse_config(r#"{"url":"file:///etc/passwd"}"#),
            Err(ConfigError::InvalidScheme)
        );
    }

    #[test]
    fn rejects_javascript_scheme() {
        assert_eq!(
            parse_config(r#"{"url":"javascript:alert(1)"}"#),
            Err(ConfigError::InvalidScheme)
        );
    }

    #[test]
    fn rejects_quote_injection() {
        assert_eq!(
            parse_config(r#"{"url":"http://x';alert(1)//"}"#),
            Err(ConfigError::InvalidScheme)
        );
    }

    #[test]
    fn invalid_json() {
        assert!(parse_config("not json").is_err());
    }

    #[test]
    fn accepts_utf8_bom() {
        // Notepad / PowerShell -Encoding UTF8 thêm BOM -> vẫn phải parse được.
        assert_eq!(
            parse_config("\u{feff}{\"url\":\"http://garage.local\"}").unwrap(),
            "http://garage.local"
        );
    }
}
