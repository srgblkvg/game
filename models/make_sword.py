"""
Стон могильщика — junk weapon (sword)
Rusted, chipped blade with crude bone-wrapped handle.
"""
import bpy
import math
import sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, center_and_export, COLORS

setup_scene()

mat_rust = make_material("RustIron", COLORS["rust_iron"], roughness=0.8, metallic=0.7)
mat_bone = make_material("OldBone", COLORS["old_bone"], roughness=0.6)
mat_blood = make_material("DriedBlood", COLORS["dried_blood"], roughness=0.9)

# ── Blade: flattened cube, tapered ──
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.5))
blade = bpy.context.object
blade.name = "Blade"
blade.scale = (0.08, 0.02, 0.7)

# Taper the tip in edit mode
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

for v in blade.data.vertices:
    if v.co.z > 0.4:
        v.co.x *= 0.3
        v.co.y *= 0.3
    if v.co.z < -0.5:
        v.co.x *= 1.4  # wider at base

# Chip at the edge
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_mode(type='FACE')
bpy.ops.mesh.select_all(action='DESELECT')

bpy.ops.object.mode_set(mode='OBJECT')
for poly in blade.data.polygons:
    center = poly.center
    if 0.0 < center.z < 0.3 and center.x > 0.02:
        poly.select = True

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.delete(type='FACE')
bpy.ops.object.mode_set(mode='OBJECT')

blade.data.materials.append(mat_rust)

# ── Blood stain decal (flat plane on blade) ──
bpy.ops.mesh.primitive_plane_add(size=0.3, location=(0.04, 0, 0.2))
stain = bpy.context.object
stain.name = "BloodStain"
stain.rotation_euler = (0, math.radians(90), 0)
stain.scale = (0.25, 0.08, 1)
stain.data.materials.append(mat_blood)

# ── Handle: bone-wrapped cylinder ──
bpy.ops.mesh.primitive_cylinder_add(radius=0.06, depth=0.25, location=(0, 0, -0.65))
handle = bpy.context.object
handle.name = "Handle"
handle.data.materials.append(mat_bone)

# Add bone ridges (torus rings)
for i, z in enumerate([-0.58, -0.63, -0.68, -0.72]):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.07, minor_radius=0.01,
        location=(0, 0, z),
        major_segments=8, minor_segments=4
    )
    ring = bpy.context.object
    ring.name = f"Bone_Ring_{i}"
    ring.data.materials.append(mat_bone)

# ── Guard: twisted bone crosspiece ──
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.48))
guard = bpy.context.object
guard.name = "Guard"
guard.scale = (0.25, 0.03, 0.04)
guard.rotation_euler = (0, 0, math.radians(15))
guard.data.materials.append(mat_bone)

# ── Finalize ──
center_and_export('/mnt/c/project/game/models/output/weapon_junk_sword.blend')
# export_glb('/mnt/c/project/game/models/output/weapon_junk_sword.glb')

print("DONE: Стон могильщика")
