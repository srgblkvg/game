"""
Скорбный капюшон — junk helmet
Torn cloth hood, sagging, with stitch holes and ragged edge.
"""
import bpy
import math
import sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, center_and_export, COLORS

setup_scene()

mat_cloth = make_material("TornCloth", COLORS["torn_cloth"], roughness=0.9)
mat_stitch = make_material("OldThread", COLORS["old_bone"], roughness=0.7)

# ── Hood base: deformed UV sphere ──
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.7, location=(0, 0, 1.0))
hood = bpy.context.object
hood.name = "Hood_Base"

# Flatten bottom, stretch upward
for v in hood.data.vertices:
    if v.co.z < 0.3:
        v.co.z *= 0.4
    v.co.z *= 1.3
    v.co.x *= 0.85  # narrower

# Tear at the bottom edge - delete some faces
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

for poly in hood.data.polygons:
    # Select faces near bottom-right for tear
    center = poly.center
    if center.z < 0.5 and center.x > 0.2:
        poly.select = True

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.delete(type='FACE')
bpy.ops.object.mode_set(mode='OBJECT')

# Subdivide for ragged look
hood.modifiers.new('Subdiv', 'SUBSURF')
hood.modifiers['Subdiv'].levels = 1
bpy.ops.object.modifier_apply(modifier='Subdiv')

# Displace for fabric folds
hood.modifiers.new('Displace', 'DISPLACE')
hood.modifiers['Displace'].strength = 0.04
tex = bpy.data.textures.new('FabricNoise', 'CLOUDS')
tex.noise_scale = 0.6
hood.modifiers['Displace'].texture = bpy.data.textures['FabricNoise']

hood.data.materials.append(mat_cloth)

# ── Stitch holes along the bottom edge ──
bpy.ops.mesh.primitive_torus_add(
    major_radius=0.45, minor_radius=0.015,
    location=(0, 0, 0.35), major_segments=12, minor_segments=6
)
stitches = bpy.context.object
stitches.name = "Stitches"
stitches.rotation_euler = (math.radians(90), 0, 0)
stitches.data.materials.append(mat_stitch)

# ── Finalize ──
center_and_export('/mnt/c/project/game/models/output/helmet_junk_hod.blend')
# export_glb('/mnt/c/project/game/models/output/helmet_junk_hod.glb')

print("DONE: Скорбный капюшон")
