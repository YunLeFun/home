/** Bézier profiles in the device icon's 64 × 64 coordinate system. */
export interface WarmerProfile {
  start: [number, number]
  curves: [number, number, number, number, number, number][]
}

export const cloud: WarmerProfile = {
  start: [19, 47],
  curves: [
    [3, 47, 3, 23, 19, 26],
    [22, 10, 42, 10, 45, 26],
    [61, 23, 61, 47, 45, 47],
    [38, 48, 26, 48, 19, 47],
  ],
}

export const sleeve: WarmerProfile = {
  start: [16, 42],
  curves: [
    [25, 44, 39, 44, 48, 42],
    [48, 48, 44, 52, 39, 52],
    [36, 52, 28, 52, 25, 52],
    [20, 52, 16, 48, 16, 42],
  ],
}

function svgPath(profile: WarmerProfile) {
  return `M${profile.start.join(' ')} ${profile.curves.map(curve => `C${curve.join(' ')}`).join(' ')} Z`
}

export const cloudPath = svgPath(cloud)
export const sleevePath = svgPath(sleeve)
