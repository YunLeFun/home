import Foundation

/// Entity-specific area assignments override their device's inherited area.
/// These are suggestions; the host app owns the user's local room mapping.
func haEntityRooms(areas: HAValue, devices: HAValue, entities: HAValue) -> [String: String] {
  var areaNames: [String: String] = [:]
  for area in areas.array {
    if let id = area["area_id"].string, let name = area["name"].string { areaNames[id] = name }
  }
  var deviceAreas: [String: String] = [:]
  for device in devices.array {
    if let id = device["id"].string, let area = device["area_id"].string { deviceAreas[id] = area }
  }
  var rooms: [String: String] = [:]
  for entity in entities.array {
    guard let id = entity["entity_id"].string, id.hasPrefix("climate.") else { continue }
    let area = entity["area_id"].string ?? entity["device_id"].string.flatMap { deviceAreas[$0] }
    if let area, let name = areaNames[area] { rooms[id] = name }
  }
  return rooms
}
