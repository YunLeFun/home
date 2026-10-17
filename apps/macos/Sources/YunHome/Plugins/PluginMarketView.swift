import AppKit
import SwiftUI
import UniformTypeIdentifiers
import HomeCore
import HomePlugins

/// The bundled, reviewed plugin catalog.
enum BundledPluginCatalog {
  static var directory: URL? { Bundle.module.url(forResource: "Plugins", withExtension: nil) }
  static func load() -> [PluginCatalogEntry] {
    guard let url = directory?.appendingPathComponent("catalog.json") else { return [] }
    return (try? PluginCatalog.load(from: url).plugins) ?? []
  }
}

struct PluginMarketView: View {
  @Bindable var store: HomeStore
  let open: (String) -> Void
  @State private var entries = BundledPluginCatalog.load()
  @State private var selection: PluginCatalogEntry?
  @State private var pendingFile: (url: URL, package: PluginPackage)?
  @State private var message: String?

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        HStack(alignment: .top) {
          VStack(alignment: .leading, spacing: 7) {
            Text("插件市场").font(.system(size: 30, weight: .bold))
            Text("为家园添加新设备。插件在独立沙箱中运行，控件由系统原生组件呈现。")
              .font(.callout).foregroundStyle(.secondary)
          }
          Spacer()
          Button("从文件安装…", systemImage: "square.and.arrow.down") { chooseFile() }
            .help("安装 .yunplugin 插件包")
        }

        HomeSectionHeading(title: "精选插件", detail: "\(entries.count) 个")
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 16)], spacing: 16) {
          ForEach(entries) { entry in
            PluginMarketCard(entry: entry, installed: store.installedPlugins[entry.id] != nil) { selection = entry }
          }
        }

        Label("精选插件经过审核并校验完整性；从文件安装的插件未经审核，请只安装你信任的来源。", systemImage: "lock.shield")
          .font(.caption).foregroundStyle(.secondary)
        if let message {
          Label(message, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
      }
      .padding(HomeTheme.contentPadding).frame(maxWidth: 1100).frame(maxWidth: .infinity)
      .animation(.smooth, value: message)
    }
    .navigationTitle("插件市场")
    .sheet(item: $selection) { entry in
      PluginMarketDetail(store: store, entry: entry, open: { id in selection = nil; open(id) })
    }
    .confirmationDialog(pendingFile.map { "安装未认证插件“\($0.package.manifest.name)”？" } ?? "",
                        isPresented: Binding(get: { pendingFile != nil }, set: { if !$0 { pendingFile = nil } }),
                        presenting: pendingFile) { file in
      Button("仍然安装") { installFile(file.url) }
      Button("取消", role: .cancel) {}
    } message: { file in
      Text(fileMessage(file.package))
    }
  }

  private func fileMessage(_ package: PluginPackage) -> String {
    let manifest = package.manifest
    let permissions = manifest.permissions.isEmpty ? "未申请任何权限" : manifest.permissions.map(PluginPermission.describe).joined(separator: "；")
    return "\(manifest.author.name) · v\(manifest.version)\n\(permissions)\n此插件未经云乐坊审核。它会在沙箱中运行，但仍可能表现异常。"
  }

  private func chooseFile() {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = [UTType(filenameExtension: "yunplugin") ?? .zip, .zip]
    panel.allowsMultipleSelection = false
    panel.prompt = "检查插件"
    guard panel.runModal() == .OK, let url = panel.url else { return }
    do { pendingFile = (url, try store.inspect(file: url)); message = nil }
    catch { message = error.localizedDescription }
  }

  private func installFile(_ url: URL) {
    Task {
      do { open(try await store.install(file: url).id); message = nil }
      catch { message = error.localizedDescription }
    }
  }
}

struct PluginMarketCard: View {
  let entry: PluginCatalogEntry
  let installed: Bool
  let select: () -> Void
  @State private var hovered = false
  private var tint: Color { Color(pluginHex: entry.tint) ?? HomeTheme.moss }

  var body: some View {
    Button(action: select) {
      HomeCard {
        VStack(alignment: .leading, spacing: 14) {
          HStack(alignment: .top) {
            PluginBadge(symbol: entry.symbol, tint: tint, size: 48)
              .scaleEffect(hovered ? 1.06 : 1)
              .rotationEffect(.degrees(hovered ? -4 : 0))
            Spacer()
            if installed {
              Label("已安装", systemImage: "checkmark.circle.fill").font(.caption.weight(.medium)).foregroundStyle(HomeTheme.moss)
            }
          }
          VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 5) {
              Text(entry.name).font(.headline)
              if entry.verified {
                Image(systemName: "checkmark.seal.fill").font(.caption).foregroundStyle(.blue).help("已认证")
              }
            }
            Text(entry.description).font(.subheadline).foregroundStyle(.secondary).lineLimit(2, reservesSpace: true)
          }
          HStack {
            Text(entry.author)
            Spacer()
            Text("v\(entry.version)")
          }.font(.caption).foregroundStyle(.tertiary)
        }
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .overlay(RoundedRectangle(cornerRadius: HomeTheme.cornerRadius).strokeBorder(tint.opacity(hovered ? 0.4 : 0), lineWidth: 1))
    .shadow(color: tint.opacity(hovered ? 0.18 : 0), radius: 14, y: 6)
    .offset(y: hovered ? -2 : 0)
    .onHover { hovered = $0 }
    .animation(.spring(duration: 0.3, bounce: 0.35), value: hovered)
    .accessibilityLabel("\(entry.name)，\(installed ? "已安装" : "未安装")")
  }
}

struct PluginMarketDetail: View {
  @Bindable var store: HomeStore
  let entry: PluginCatalogEntry
  let open: (String) -> Void
  @Environment(\.dismiss) private var dismiss
  @State private var confirming = false
  @State private var installing = false
  @State private var error: String?
  private var installedInstance: PluginInstance? { store.snapshot.plugins.first { $0.pluginId == entry.id } }
  private var tint: Color { Color(pluginHex: entry.tint) ?? HomeTheme.moss }

  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      HStack(spacing: 16) {
        PluginBadge(symbol: entry.symbol, tint: tint, size: 64)
          .symbolEffect(.bounce, value: installedInstance != nil)
        VStack(alignment: .leading, spacing: 5) {
          HStack(spacing: 6) {
            Text(entry.name).font(.title2.weight(.semibold))
            if entry.verified { Image(systemName: "checkmark.seal.fill").foregroundStyle(.blue) }
          }
          Text("\(entry.author) · v\(entry.version) · \(entry.category)").font(.callout).foregroundStyle(.secondary)
        }
        Spacer()
      }
      Text(entry.description)

      GroupBox {
        VStack(alignment: .leading, spacing: 10) {
          if entry.permissions.isEmpty {
            Label("不需要任何权限", systemImage: "hand.raised.slash")
          }
          ForEach(entry.permissions, id: \.self) { permission in
            Label(PluginPermission.describe(permission), systemImage: "key")
          }
          if entry.renderer == "cute-ac-3d" {
            Label("使用家园提供的三维空调模型", systemImage: "cube.transparent")
          }
          Label("逻辑在独立进程的沙箱中运行，无法联网或读取文件", systemImage: "lock.shield")
        }.frame(maxWidth: .infinity, alignment: .leading).font(.callout).padding(4)
      } label: { Text("权限与运行方式") }

      if let error {
        Label(error, systemImage: "exclamationmark.triangle").font(.caption).foregroundStyle(.orange)
      }

      HStack {
        if let homepage = entry.homepage.flatMap(URL.init(string:)) { Link("查看源码", destination: homepage).font(.callout) }
        Spacer()
        Button("关闭") { dismiss() }.keyboardShortcut(.cancelAction)
        if let installedInstance {
          Button("打开设备") { open(installedInstance.id) }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
        } else {
          Button { confirming = true } label: {
            if installing { ProgressView().controlSize(.small).frame(width: 40) } else { Text("安装") }
          }
          .buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction).disabled(installing)
        }
      }
    }
    .padding(24).frame(width: 480)
    .animation(.smooth, value: installedInstance != nil)
    .confirmationDialog("安装“\(entry.name)”？", isPresented: $confirming) {
      Button("安装") { install() }
    } message: {
      Text(entry.permissions.isEmpty ? "此插件不需要任何权限。" : entry.permissions.map(PluginPermission.describe).joined(separator: "\n"))
    }
  }

  private func install() {
    guard let directory = BundledPluginCatalog.directory else { error = "找不到插件目录"; return }
    installing = true
    Task {
      do {
        let instance = try await store.install(entry, from: directory)
        installing = false
        try? await Task.sleep(for: .milliseconds(450))
        open(instance.id)
      } catch {
        installing = false
        self.error = error.localizedDescription
      }
    }
  }
}
