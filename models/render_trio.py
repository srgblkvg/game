"""
All three junk items in one scene, spaced apart for review.
"""
import bpy
import math
import sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, COLORS

# Clear and set up
setup_scene()

# Move camera back to see all three
for obj in bpy.data.objects:
    if obj.type == 'CAMERA':
        obj.location = (0, -5, 2.5)
        obj.rotation_euler = (math.radians(75), 0, 0)
        bpy.context.scene.camera = obj

# Widen render
bpy.context.scene.render.resolution_x = 1024
bpy.context.scene.render.resolution_y = 512

# ──────────────────────────────────────────────
# 1. Скорбный капюшон (left: x=-1.2)
# ──────────────────────────────────────────────
mat_cloth = make_material("TornCloth", COLORS["torn_cloth"], roughness=0.9)
mat_stitch = make_material("OldThread", COLORS["old_bone"], roughness=0.7)

bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.7, location=(-1.2, 0, 1.0))
hood = bpy.context.object
hood.name = "Hood_Sorrowful"
for v in hood.data.vertices:
    if v.co.z < 0.3:
        v.co.z *= 0.4
    v.co.z *= 1.3
    v.co.x *= 0.85

for poly in hood.data.polygons:
    center = poly.center
    if center.z < 0.5 and center.x > 0.2:
        poly.select = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.delete(type='FACE')
bpy.ops.object.mode_set(mode='OBJECT')

hood.modifiers.new('Subdiv', 'SUBSURF')
hood.modifiers['Subdiv'].levels = 1
bpy.ops.object.modifier_apply(modifier='Subdiv')

hood.modifiers.new('Displace', 'DISPLACE')
hood.modifiers['Displace'].strength = 0.04
tex = bpy.data.textures.new('FabricNoise', 'CLOUDS')
tex.noise_scale = 0.6
hood.modifiers['Displace'].texture = tex
hood.data.materials.append(mat_cloth)

bpy.ops.mesh.primitive_torus_add(
    major_radius=0.45, minor_radius=0.015,
    location=(-1.2, 0, 0.35), major_segments=12, minor_segments=6
)
stitches = bpy.context.object
stitches.name = "Hood_Stitches"
stitches.rotation_euler = (math.radians(90), 0, 0)
stitches.data.materials.append(mat_stitch)

# ──────────────────────────────────────────────
# 2. Стон могильщика (center: x=0)
# ──────────────────────────────────────────────
mat_rust = make_material("RustIron", COLORS["rust_iron"], roughness=0.8, metallic=0.7)
mat_bone = make_material("OldBone2", COLORS["old_bone"], roughness=0.6)
mat_blood = make_material("DriedBlood", COLORS["dried_blood"], roughness=0.9)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
blade = bpy.context.object
blade.name = "Blade"
blade.scale = (0.08, 0.02, 0.7)

for v in blade.data.vertices:
    if v.co.z > 0.4:
        v.co.x *= 0.3; v.co.y *= 0.3
    if v.co.z < -0.5:
        v.co.x *= 1.4

for poly in blade.data.polygons:
    center = poly.center
    if 0.0 < center.z < 0.3 and center.x > 0.02:
        poly.select = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.delete(type='FACE')
bpy.ops.object.mode_set(mode='OBJECT')
blade.data.materials.append(mat_rust)

bpy.ops.mesh.primitive_plane_add(size=0.3, location=(0.04, 0, 0.2))
stain = bpy.context.object
stain.name = "BloodStain"
stain.rotation_euler = (0, math.radians(90), 0)
stain.scale = (0.25, 0.08, 1)
stain.data.materials.append(mat_blood)

bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.25, location=(0, 0, -0.65))
handle = bpy.context.object
handle.name = "Handle"
handle.data.materials.append(mat_bone)

for i, z in enumerate([-0.58, -0.63, -0.68, -0.72]):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.07, minor_radius=0.01,
        location=(0, 0, z), major_segments=8, minor_segments=4
    )
    ring = bpy.context.object
    ring.name = f"Bone_Ring_{i}"
    ring.data.materials.append(mat_bone)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.48))
guard = bpy.context.object
guard.name = "Guard"
guard.scale = (0.25, 0.03, 0.04)
guard.rotation_euler = (0, 0, math.radians(15))
guard.data.materials.append(mat_bone)

# ──────────────────────────────────────────────
# 3. Гробовая преграда (right: x=1.2)
# ──────────────────────────────────────────────
mat_wood = make_material("RottenWood", COLORS["rotten_wood"], roughness=0.95)
mat_iron = make_material("TarnishedIron", COLORS["tarnished_iron"], roughness=0.7, metallic=0.8)
mat_dirt = make_material("GraveSoil", COLORS["grave_dirt"], roughness=1.0)

for i, px in enumerate([-0.22, 0, 0.22]):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.2 + px, 0, 0))
    plank = bpy.context.object
    plank.name = f"Plank_{i}"
    plank.scale = (0.1, 0.02, 0.45)
    for v in plank.data.vertices:
        if v.co.z > 0.3: v.co.z += (v.co.x * 0.3)
        if v.co.z < -0.3: v.co.z -= (abs(v.co.x) * 0.2)
    plank.data.materials.append(mat_wood)

for z in [-0.15, 0.15]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.2, 0.015, z))
    band = bpy.context.object
    band.name = f"IronBand_{z}"
    band.scale = (0.28, 0.01, 0.03)
    band.data.materials.append(mat_iron)

for px in [-0.22, 0, 0.22]:
    for z in [-0.15, 0.15]:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.015, depth=0.02,
            location=(1.2 + px, 0.025, z),
            rotation=(math.radians(90), 0, 0)
        )
        nail = bpy.context.object
        nail.name = f"Nail_{px}_{z}"
        nail.data.materials.append(mat_iron)

bpy.ops.mesh.primitive_cylinder_add(
    radius=0.03, depth=0.25,
    location=(1.2, -0.04, 0),
    rotation=(math.radians(90), 0, 0)
)
handle2 = bpy.context.object
handle2.name = "Handle_Back"
handle2.data.materials.append(mat_iron)

bpy.ops.mesh.primitive_plane_add(size=0.4, location=(1.2, 0.015, 0.08))
dirt = bpy.context.object
dirt.name = "Dirt_Overlay"
dirt.rotation_euler = (math.radians(90), 0, 0)
dirt.scale = (0.5, 0.35, 1)
dirt.data.materials.append(mat_dirt)

# ── Save ──
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath='/mnt/c/project/game/models/output/all_junk_trio.blend')
print("Saved: all_junk_trio.blend")
