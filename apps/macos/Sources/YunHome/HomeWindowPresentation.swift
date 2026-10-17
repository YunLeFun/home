import Observation

/// Shared with the menu-bar panel so window visibility follows actual window
/// events, and opening settings or a device uses the existing main window.
@MainActor @Observable
final class HomeWindowPresentation {
  var selection: HomeDestination? = .overview
  var isMainWindowVisible = false
}
