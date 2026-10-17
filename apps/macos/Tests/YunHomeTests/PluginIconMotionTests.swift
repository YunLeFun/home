import Foundation
import Testing
import HomePlugins
@testable import YunHome

@Test func spinClockKeepsItsAngleAcrossSpeedChanges() {
  let start = Date(timeIntervalSinceReferenceDate: 0)
  var clock = PluginIconSpinClock(start: start, speed: 1)
  let switchAt = start.addingTimeInterval(2)
  #expect(clock.time(at: switchAt) == 2)

  clock.change(to: 2.2, at: switchAt)
  // No jump at the moment of the change.
  #expect(abs(clock.time(at: switchAt) - 2) < 1e-9)
  // The speed eases from 1 to 2.2 over the ramp, then holds.
  #expect(abs(clock.speed(at: switchAt.addingTimeInterval(PluginIconSpinClock.ramp / 2)) - 1.6) < 1e-9)
  let afterRamp = switchAt.addingTimeInterval(PluginIconSpinClock.ramp)
  #expect(abs(clock.time(at: afterRamp) - (2 + 0.5 * (1 + 2.2) / 2)) < 1e-9)
  #expect(abs(clock.time(at: afterRamp.addingTimeInterval(1)) - clock.time(at: afterRamp) - 2.2) < 1e-9)

  // Time only ever moves forward, sampled every frame through the change.
  var previous = 0.0
  for frame in 0...240 {
    let now = start.addingTimeInterval(Double(frame) / 60)
    let time = clock.time(at: now)
    #expect(time >= previous)
    previous = time
  }
}

@Test func delayedFlowHoldsItsInvisibleFirstFrame() {
  // `PluginIconCanvas` draws a delayed shape with the pose at time 0.
  let first = PluginIconMotion.pose(.flow, time: 0, spinTime: 0)
  #expect(first.opacity < 0.001)
  #expect(PluginIconMotion.pose(.flow, time: 0.54, spinTime: 0).opacity > 0.99)
  // These motions rest at their first frame; sway starts tilted, as on the web.
  for motion in [PluginIcon.Motion.spin, .pulse, .float, .blink] {
    let pose = PluginIconMotion.pose(motion, time: 0, spinTime: 0)
    #expect(pose.opacity == 1)
    #expect(pose.transform == .identity)
  }
}
