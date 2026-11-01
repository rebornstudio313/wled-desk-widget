use semver::Version;
use serde_json::{json, Value};
const RELEASES: &str = "https://github.com/rebornstudio313/wled-desk-widget/releases";
pub fn select(releases: &Value, current: &str) -> Result<Value, String> {
    let installed = Version::parse(current).map_err(|_| "Неверная версия приложения")?;
    let items = releases.as_array().ok_or("Неподходящий ответ GitHub")?;
    let mut versions = Vec::new();
    for release in items {
        let Some(tag) = release["tag_name"].as_str().filter(|s| s.len() <= 200) else {
            continue;
        };
        let Ok(version) = Version::parse(tag.strip_prefix('v').unwrap_or(tag)) else {
            continue;
        };
        if release["draft"].as_bool().unwrap_or(false)
            || release["published_at"]
                .as_str()
                .filter(|v| !v.is_empty())
                .is_none()
            || (installed.pre.is_empty()
                && (!version.pre.is_empty() || release["prerelease"].as_bool().unwrap_or(false)))
        {
            continue;
        }
        let mut url = reqwest::Url::parse(RELEASES).unwrap();
        url.path_segments_mut().unwrap().push("tag").push(tag);
        versions.push((version,json!({"version":tag.strip_prefix('v').unwrap_or(tag),"tag":tag,"url":url.as_str(),"publishedAt":release["published_at"]})));
    }
    versions.sort_by(|a, b| b.0.cmp_precedence(&a.0));
    if let Some((version, latest)) = versions.first() {
        Ok(
            json!({"status":if version.cmp_precedence(&installed).is_gt(){"available"}else{"current"},"latest":latest}),
        )
    } else {
        Ok(json!({"status":"unpublished","latest":null}))
    }
}
#[tauri::command]
pub async fn check_updates() -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("WLED-Desk-Widget/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| "Не удалось подготовить проверку")?;
    let mut response = client
        .get("https://api.github.com/repos/rebornstudio313/wled-desk-widget/releases?per_page=100")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|_| "Не удалось связаться с GitHub. Проверьте интернет и повторите попытку.")?;
    if response.status().as_u16() == 403 || response.status().as_u16() == 429 {
        return Err("GitHub временно ограничил проверки. Попробуйте позже.".into());
    }
    if !response.status().is_success() {
        return Err("Не удалось получить список выпусков GitHub. Попробуйте позже.".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Не удалось прочитать ответ GitHub")?
    {
        if bytes.len() + chunk.len() > 2097152 {
            return Err("Ответ GitHub слишком большой".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    select(
        &serde_json::from_slice(&bytes).map_err(|_| "GitHub вернул неподходящий ответ")?,
        env!("CARGO_PKG_VERSION"),
    )
}
#[tauri::command]
pub fn get_build_info() -> Value {
    json!({"version":env!("CARGO_PKG_VERSION"),"buildId":env!("WLED_DESK_BUILD_ID"),"builtAt":env!("WLED_DESK_BUILT_AT"),"sourceHash":env!("WLED_DESK_SOURCE_HASH")})
}
fn allowed_link(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && (url.path() == "/rebornstudio313/wled-desk-widget/releases"
            || url
                .path()
                .starts_with("/rebornstudio313/wled-desk-widget/releases/tag/"))
}
#[tauri::command]
pub fn open_release(url: String) -> Result<(), String> {
    if !allowed_link(&url) {
        return Err("Недопустимая ссылка на выпуск".into());
    }
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(url)
            .spawn()
            .map_err(|_| "Не удалось открыть браузер")?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err("Открытие ссылки поддерживается в Windows-версии".into())
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn release(tag: &str) -> Value {
        json!({"tag_name":tag,"draft":false,"prerelease":tag.contains('-'),"published_at":"2026-11-01T00:00:00Z"})
    }
    #[test]
    fn selects_semantic_versions_and_channels() {
        assert_eq!(
            select(
                &json!([release("v0.1.0-alpha.9"), release("v0.1.0-alpha.10")]),
                "0.1.0-alpha.2"
            )
            .unwrap()["latest"]["version"],
            "0.1.0-alpha.10"
        );
        assert_eq!(
            select(&json!([release("v0.2.0-beta.1")]), "0.1.0").unwrap()["status"],
            "unpublished"
        );
        assert_eq!(
            select(
                &json!([release("v0.1.0-alpha.2+other")]),
                "0.1.0-alpha.2+local"
            )
            .unwrap()["status"],
            "current"
        );
        let mut draft = release("v99.0.0");
        draft["draft"] = json!(true);
        assert_eq!(
            select(&json!([draft, release("junk")]), "0.1.0").unwrap()["status"],
            "unpublished"
        );
    }
    #[test]
    fn only_opens_project_release_pages() {
        assert!(allowed_link(RELEASES));
        assert!(allowed_link(&(RELEASES.to_string() + "/tag/v0.1.0")));
        assert!(!allowed_link("https://evil.test/releases"));
        assert!(!allowed_link("file:///C:/Windows/system32/cmd.exe"));
        assert!(!allowed_link(&(RELEASES.to_string() + "?redirect=evil")));
    }
    #[test]
    #[ignore = "Manual public GitHub connectivity check"]
    fn public_release_probe() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();
        let result = runtime.block_on(check_updates()).unwrap();
        println!("GitHub release check: {}", result["status"]);
    }
}
