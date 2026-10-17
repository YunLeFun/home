import SwiftUI
import HomeCore

struct HADeviceTile: View {
  let store: HomeStore
  let device: HADeviceBinding
  let select: () -> Void
  var body: some View {
    HomeCard {
      VStack(alignment: .leading, spacing: 17) {
        HStack {
          Button(action: select) { DeviceBadge(device: .airConditioner, size: 44) }
            .buttonStyle(.plain).accessibilityLabel("查看\(device.label)")
          Spacer()
          Button { store.toggleHADevice(device.id) } label: {
            Image(systemName: "power").foregroundStyle(store.isHAActive(device.id) ? HomeTheme.brand : .secondary)
          }.disabled(store.haConnections[device.id]?.canControl != true)
            .accessibilityLabel("\(device.label)电源")
        }
        Button(action: select) {
          VStack(alignment: .leading, spacing: 7) {
            Text(device.name).font(.headline).foregroundStyle(.primary).lineLimit(2)
            Text(store.haStatus(device.id)).font(.subheadline).foregroundStyle(.secondary)
            Label(device.room.name, systemImage: device.room.symbol)
              .font(.caption).foregroundStyle(.tertiary).padding(.top, 7)
          }.frame(maxWidth: .infinity, alignment: .leading).contentShape(Rectangle())
        }.buttonStyle(.plain)
      }
    }
  }
}
