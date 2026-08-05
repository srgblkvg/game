"""
Гробовая преграда — junk shield
Coffin planks nailed together, splintered edge, iron bands.
"""
import bpy
import math
import sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, center_and_export, COLORS

setup_scene()

mat_wood = make_material("RottenWood", COLORS["rotten_wood"], roughness=0.95)
mat_iron = make_material("TarnishedIron", COLORS["tarnished_iron"], roughness=0.7, metallic=0.8)
mat_dirt = make_material("GraveDirt", COLORS["grave_dirt"], roughness=1.0)

# ── 3 vertical planks ──
plank_positions = [-0.22, 0, 0.22]
planks = []

for i, x in enumerate(plank_positions):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0, 0))
    plank = bpy.context.object
    plank.name = f"Plank_{i}"
    plank.scale = (0.1, 0.02, 0.45)
    
    # Splinter top/bottom
    for v in plank.data.vertices:
        if v.co.z > 0.3:
            v.co.z += (v.co.x * 0.3)  # jagged top
        if v.co.z < -0.3:
            v.co.z -= (abs(v.co.x) * 0.2)  # jagged bottom
    
    plank.data.materials.append(mat_wood)
    planks.append(plank)

# ── 2 horizontal iron bands ──
for z in [-0.15, 0.15]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.015, z))
    band = bpy.context.object
    band.name = f"IronBand_{z}"
    band.scale = (0.28, 0.01, 0.03)
    band.data.materials.append(mat_iron)

# ── Nail heads (small cylinders) ──
for x in plank_positions:
    for z in [-0.15, 0.15]:
        bpy.ops.mesh.primitive_cylinder_add(
            radius=0.015, depth=0.02,
            location=(x, 0.025, z),
            rotation=(math.radians(90), 0, 0)
        )
        nail = bpy.context.object
        nail.name = f"Nail_{x}_{z}"
        nail.data.materials.append(mat_iron)

# ── Handle on back ──
bpy.ops.mesh.primitive_cylinder_add(
    radius=0.03, depth=0.25,
    location=(0, -0.04, 0),
    rotation=(math.radians(90), 0, 0)
)
handle = bpy.context.object
handle.name = "Handle_Back"
handle.data.materials.append(mat_iron)

# ── Dirt smudge overlay ──
bpy.ops.mesh.primitive_plane_add(size=0.4, location=(0, 0.015, 0.08))
dirt = bpy.context.object
dirt.name = "Dirt_Overlay"
dirt.rotation_euler = (math.radians(90), 0, 0)
dirt.scale = (0.5, 0.35, 1)
dirt.data.materials.append(mat_dirt)

# ── Finalize ──
center_and_export('/mnt/c/project/game/models/output/shield_junk_coffin.blend')
# export_glb('/mnt/c/project/game/models/output/shield_junk_coffin.glb')

print("DONE: Гробовая преграда")
