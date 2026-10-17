import SwiftUI
import HomeCore

enum HomeTheme {
  static let ink = Color(red: 0.157, green: 0.192, blue: 0.184)
  static let moss = Color(red: 0.408, green: 0.482, blue: 0.404)
  static let gold = Color(red: 0.773, green: 0.604, blue: 0.333)
  static let paper = Color(nsColor: .windowBackgroundColor)
  static let card = Color(nsColor: .controlBackgroundColor)
  static let separator = Color(nsColor: .separatorColor)
  static let cornerRadius: CGFloat = 16
  static let contentPadding: CGFloat = 24
  static var modelBackground: LinearGradient {
    LinearGradient(colors: [Color(nsColor: .controlBackgroundColor), Color(nsColor: .windowBackgroundColor)],
                   startPoint: .top, endPoint: .bottom)
  }

}

extension DeviceKind {
  var tint: Color {
    switch self {
    case .airConditioner: .blue
    case .fan: HomeTheme.moss
    case .robotVacuum: .indigo
    case .handWarmer: HomeTheme.gold
    case .television: .purple
    }
  }
}

struct HomeCard<Content: View>: View {
  @ViewBuilder var content: Content
  var body: some View {
    content.padding(18)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(HomeTheme.card, in: RoundedRectangle(cornerRadius: HomeTheme.cornerRadius, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: HomeTheme.cornerRadius, style: .continuous)
        .strokeBorder(HomeTheme.separator.opacity(0.32), lineWidth: 0.5))
      .shadow(color: .black.opacity(0.035), radius: 6, x: 0, y: 2)
  }
}

struct DeviceBadge: View {
  let device: DeviceKind
  var size: CGFloat = 42
  var body: some View {
    Image(systemName: device.symbol)
      .font(.system(size: size * 0.43, weight: .medium))
      .symbolRenderingMode(.hierarchical)
      .foregroundStyle(device.tint)
      .frame(width: size, height: size)
      .background(device.tint.opacity(0.11), in: RoundedRectangle(cornerRadius: size * 0.28, style: .continuous))
      .accessibilityHidden(true)
  }
}

struct HomeStatusBadge: View {
  let title: String
  let symbol: String
  var tint: Color = HomeTheme.moss
  var body: some View {
    Label(title, systemImage: symbol)
      .font(.caption.weight(.medium))
      .foregroundStyle(tint)
      .padding(.horizontal, 10).padding(.vertical, 6)
      .background(tint.opacity(0.09), in: Capsule())
      .accessibilityElement(children: .combine)
  }
}

struct HomeSectionHeading: View {
  let title: String
  var detail: String? = nil
  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text(title).font(.headline)
      Spacer()
      if let detail { Text(detail).font(.caption).foregroundStyle(.secondary) }
    }
  }
}

struct ACPreview: View {
  let state: ACState
  var interactive = true
  @State private var controller: ACSceneController?
  @State private var modelError: String?
  var body: some View {
    Group {
      if let controller {
        ACSceneView(controller: controller, state: state, isActive: true, interactive: interactive)
      } else if let modelError {
        Label(modelError, systemImage: "exclamationmark.triangle")
          .font(.caption).foregroundStyle(.secondary)
      } else {
        ProgressView().controlSize(.small)
      }
    }
    .task {
      guard controller == nil else { return }
      do {
        controller = try await ACSceneController.load()
        modelError = nil
      } catch is CancellationError {
        // Leaving a detail page cancels loading; the next appearance retries.
      } catch {
        modelError = error.localizedDescription
      }
    }
    .accessibilityLabel("三维云空调，\(state.status ? "已开启" : "待机")，\(state.temperature)摄氏度")
  }
}
