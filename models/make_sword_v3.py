"""
Стон могильщика v3 — proper poly modeling.
Handle cylinder → extrude guard → extrude blade.
"""
import bpy, math, sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, COLORS

# Clean start
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
setup_scene()

# Camera
for c in bpy.data.objects:
    if c.type == 'CAMERA':
        c.location = (0, -3, 1)
        c.rotation_euler = (math.radians(72), 0, 0)

# ── Materials ──
mat_blade = make_material("Blade", (0.15, 0.10, 0.08, 1.0), roughness=0.7, metallic=0.7)  # dark rusted steel
mat_bone  = make_material("Bone",  (0.50, 0.45, 0.35, 1.0), roughness=0.5)                  # aged bone
mat_wrap  = make_material("Wrap",  (0.18, 0.15, 0.12, 1.0), roughness=0.9)                  # leather wrap

# ── Build sword: cylinder → extrude up ──
bpy.ops.mesh.primitive_cylinder_add(
    vertices=8, radius=0.06, depth=0.5,
    location=(0, 0, -0.25), rotation=(0, 0, 0)
)
obj = bpy.context.object
obj.name = "Sword"

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_mode(type='FACE')

# Select top face, extrude guard
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# Find top face (z > 0 on the cylinder, handle goes from z=-0.5 to z=0)
for poly in obj.data.polygons:
    if poly.center.z > 0.01:
        poly.select = True
        break

bpy.ops.object.mode_set(mode='EDIT')

# Extrude guard crosspiece (wide, thin)
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.03)}
)
bpy.ops.transform.resize(value=(2.5, 0.4, 1))

# Extrude up for guard top
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.04)}
)
bpy.ops.transform.resize(value=(0.5, 0.5, 1))

# Extrude blade base (wider)
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.06)}
)
bpy.ops.transform.resize(value=(1.5, 1.3, 1))

# Extrude blade mid
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.3)}
)
bpy.ops.transform.resize(value=(0.8, 0.8, 1))

# Extrude blade near tip
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.25)}
)
bpy.ops.transform.resize(value=(0.4, 0.4, 1))

# Extrude tip
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.12)}
)
bpy.ops.transform.resize(value=(0.1, 0.1, 1))

# ── Flatten blade (make it thin like a sword) ──
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# Select blade vertices (z > 0.13, above guard) and scale Y to 0.15
for v in obj.data.vertices:
    if v.co.z > 0.13:
        v.select = True

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.resize(value=(1, 0.15, 1))

# ── Widen blade in X (give it sword width) ──
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

for v in obj.data.vertices:
    if v.co.z > 0.13:
        v.select = True

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.resize(value=(2.0, 1, 1))

# ── Handle rings (select loops on handle, scale up slightly) ──
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# Bottom face of handle
for poly in obj.data.polygons:
    if poly.center.z < -0.24:
        poly.select = True
        break

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.extrude_region_move(
    TRANSFORM_OT_translate={"value": (0, 0, 0.04)}
)
bpy.ops.transform.resize(value=(1.3, 1.3, 1))

# ── Bevel for worn edges ──
bpy.ops.object.mode_set(mode='OBJECT')
obj.modifiers.new('Bevel', 'BEVEL')
obj.modifiers['Bevel'].width = 0.008
obj.modifiers['Bevel'].segments = 2

# ── Chip the blade edge ──
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# Find a vertex on the blade edge and push it in
for v in obj.data.vertices:
    if 0.4 < v.co.z < 0.6 and v.co.x > 0.06:
        v.select = True
        break

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.translate(value=(-0.03, 0, 0))
bpy.ops.mesh.select_all(action='DESELECT')

# Second chip
bpy.ops.object.mode_set(mode='OBJECT')
for v in obj.data.vertices:
    if 0.6 < v.co.z < 0.8 and v.co.x < -0.04:
        v.select = True
        break
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.translate(value=(0.025, 0, 0))

# ── Assign materials ──
bpy.ops.object.mode_set(mode='OBJECT')
obj.data.materials.append(mat_bone)   # 0
obj.data.materials.append(mat_blade)  # 1
obj.data.materials.append(mat_wrap)   # 2

for poly in obj.data.polygons:
    cz = poly.center.z
    if cz < -0.01:
        poly.material_index = 0   # bone handle
    else:
        poly.material_index = 1   # blade

# ── Smooth ──
bpy.ops.object.shade_smooth()

# ── Save ──
bpy.ops.object.mode_set(mode='OBJECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

out = '/mnt/c/project/game/models/output/weapon_junk_sword_v3.blend'
bpy.ops.wm.save_as_mainfile(filepath=out)
print(f"Saved: {out}")
print("DONE: Стон могильщика v3")
