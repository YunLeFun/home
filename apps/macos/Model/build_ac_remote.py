#!/usr/bin/env python3
"""Build the original Yun Home remote, using only Python and macOS USD tools.

All dimensions are in metres. Separate button Xforms retain press pivots; the
screen has front-facing UVs for the live LCD. No downloaded assets are used.
"""
from pathlib import Path
import math
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "Sources/YunHome/Resources/ACRemote.usdz"
parts = []


def fmt(values):
    return ", ".join("(" + ", ".join(f"{v:.6f}" for v in value) + ")" for value in values)


def mesh(name, points, faces, material, uv=None):
    counts = ", ".join(str(len(face)) for face in faces)
    indices = ", ".join(str(index) for face in faces for index in face)
    text = f'''def Mesh "{name}" (prepend apiSchemas = ["MaterialBindingAPI"]) {{
        point3f[] points = [{fmt(points)}]
        int[] faceVertexCounts = [{counts}]
        int[] faceVertexIndices = [{indices}]
        uniform token subdivisionScheme = "none"
        uniform token orientation = "rightHanded"
        rel material:binding = </ACRemote/Looks/{material}>
'''
    if uv:
        text += f'        texCoord2f[] primvars:st = [{fmt(uv)}] (interpolation = "vertex")\n'
    return text + "    }\n"


def outline(width, height, radius):
    points = []
    for x, y, start in [(width / 2 - radius, height / 2 - radius, 0),
                        (-width / 2 + radius, height / 2 - radius, 90),
                        (-width / 2 + radius, -height / 2 + radius, 180),
                        (width / 2 - radius, -height / 2 + radius, 270)]:
        for step in range(5):
            angle = math.radians(start + step * 22.5)
            points.append((x + radius * math.cos(angle), y + radius * math.sin(angle)))
    return points


def rounded(name, width, height, depth, radius, material):
    # Four contour rings form flat faces, a chamfer and faceted side walls.
    points = []
    bevel = min(depth * 0.23, 0.016)
    for z, inset in [(-depth / 2, bevel), (-depth / 2 + bevel, 0),
                     (depth / 2 - bevel, 0), (depth / 2, bevel)]:
        points.extend((x, y, z) for x, y in outline(width - inset * 2, height - inset * 2, max(0.001, radius - inset)))
    count = len(points) // 4
    faces = [list(reversed(range(count))), list(range(3 * count, 4 * count))]
    for ring in range(3):
        for index in range(count):
            next_index = (index + 1) % count
            faces.append([ring * count + index, ring * count + next_index,
                          (ring + 1) * count + next_index, (ring + 1) * count + index])
    return mesh(name, points, faces, material)


def xform(name, position, content):
    return f'''def Xform "{name}" {{
        double3 xformOp:translate = {fmt([position])}
        uniform token[] xformOpOrder = ["xformOp:translate"]
        {content}
    }}\n'''


def stroke(name, a, b, width=0.012, material="Ink", z=0.021):
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * width / 2, dx / length * width / 2
    return mesh(name, [(a[0] + nx, a[1] + ny, z), (a[0] - nx, a[1] - ny, z),
                       (b[0] - nx, b[1] - ny, z), (b[0] + nx, b[1] + ny, z)], [[0, 1, 2, 3]], material)


def panel(name, width, height, y, z, material):
    return xform(name, (0, y, z), mesh("Surface", [(-width/2, -height/2, 0), (width/2, -height/2, 0),
        (width/2, height/2, 0), (-width/2, height/2, 0)], [[0, 1, 2, 3]], material,
        [(0, 0), (1, 0), (1, 1), (0, 1)]))


parts.append(rounded("Body", 0.62, 1.55, 0.15, 0.15, "Shell"))
parts.append(xform("Seam", (0, 0, -0.012), rounded("Mesh", 0.621, 1.548, 0.012, 0.15, "Seam")))
parts.append(xform("ScreenBezel", (0, 0.36, 0.079), rounded("Mesh", 0.485, 0.40, 0.028, 0.038, "Ink")))
parts.append(panel("Screen", 0.423, 0.338, 0.36, 0.095, "LCD"))
parts.append(xform("Infrared", (0, 0.714, 0.058), rounded("Mesh", 0.12, 0.027, 0.033, 0.013, "Ink")))
parts.append(panel("Brand", 0.27, 0.067, -0.643, 0.076, "Shell"))

power = rounded("Mesh", 0.18, 0.18, 0.038, 0.09, "Power")
for step in range(18):
    a = math.radians(135 + step * 15)
    b = math.radians(135 + (step + 1) * 15)
    power += stroke(f"Ring{step}", (0.043 * math.cos(a), 0.043 * math.sin(a)),
                    (0.043 * math.cos(b), 0.043 * math.sin(b)), material="White")
power += stroke("Stem", (0, 0.01), (0, 0.067), material="White")
parts.append(xform("PowerButton", (0, 0.028, 0.084), power))

for name, x, sign in [("TemperatureDownButton", -0.135, -1), ("TemperatureUpButton", 0.135, 1)]:
    content = rounded("Mesh", 0.215, 0.157, 0.038, 0.052, "Key")
    content += stroke("Minus", (-0.038, 0), (0.038, 0))
    if sign > 0:
        content += stroke("Plus", (0, -0.038), (0, 0.038))
    parts.append(xform(name, (x, -0.205, 0.084), content))

mode = rounded("Mesh", 0.35, 0.14, 0.038, 0.06, "Key")
for index in range(3):
    a = index * math.pi / 3
    dx, dy = 0.036 * math.cos(a), 0.036 * math.sin(a)
    mode += stroke(f"Snow{index}", (-0.085 - dx, -dy), (-0.085 + dx, dy), width=0.008)
for index in range(12):
    a, b = index * math.pi / 6, (index + 1) * math.pi / 6
    mode += stroke(f"Sun{index}", (0.085 + 0.022 * math.cos(a), 0.022 * math.sin(a)),
                   (0.085 + 0.022 * math.cos(b), 0.022 * math.sin(b)), width=0.007)
for index in range(8):
    a = index * math.pi / 4
    mode += stroke(f"Ray{index}", (0.085 + 0.032 * math.cos(a), 0.032 * math.sin(a)),
                   (0.085 + 0.044 * math.cos(a), 0.044 * math.sin(a)), width=0.006)
parts.append(xform("ModeButton", (0, -0.42, 0.084), mode))

materials = ""
for name, color in {"Shell": (0.91, 0.925, 0.9), "Seam": (0.56, 0.60, 0.57),
                    "Ink": (0.08, 0.13, 0.12), "LCD": (0.60, 0.73, 0.63),
                    "Power": (0.28, 0.43, 0.37), "Key": (0.73, 0.78, 0.73), "White": (0.95, 0.97, 0.94)}.items():
    materials += f'''def Material "{name}" {{
        token outputs:surface.connect = </ACRemote/Looks/{name}/Shader.outputs:surface>
        def Shader "Shader" {{
            uniform token info:id = "UsdPreviewSurface"
            color3f inputs:diffuseColor = {fmt([color])}
            float inputs:roughness = 0.72
            float inputs:metallic = 0
            token outputs:surface
        }}
    }}\n'''
source = '''#usda 1.0
(defaultPrim = "ACRemote"; metersPerUnit = 1; upAxis = "Y")
def Xform "ACRemote" (kind = "component") {
    def Scope "Looks" {
''' + materials + "    }\n" + "\n".join(parts) + "}\n"
with tempfile.TemporaryDirectory(prefix="yunhome-remote-") as folder:
    folder = Path(folder)
    (folder / "ACRemote.usda").write_text(source)
    subprocess.run(["usdcat", "ACRemote.usda", "-o", "ACRemote.usdc"], cwd=folder, check=True)
    subprocess.run(["usdzip", "--arkitAsset", "ACRemote.usdc", str(DESTINATION)], cwd=folder, check=True)
print(f"Built {DESTINATION} ({DESTINATION.stat().st_size:,} bytes)")
