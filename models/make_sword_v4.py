"""
Стон могильщика v4 — proper sword proportions.
Handle below → wide guard → long straight blade → taper to tip.
"""
import bpy, math, sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, COLORS

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
setup_scene()

for c in bpy.data.objects:
    if c.type == 'CAMERA':
        c.location = (0, -4, 1.5)
        c.rotation_euler = (math.radians(72), 0, 0)

mat_blade = make_material("Blade", (0.15, 0.12, 0.10, 1.0), roughness=0.7, metallic=0.75)
mat_bone  = make_material("Bone",  (0.52, 0.47, 0.37, 1.0), roughness=0.5)
mat_wrap  = make_material("Wrap",  (0.16, 0.13, 0.10, 1.0), roughness=0.95)

# ── Start from handle center, build upward ──
# Handle: cylinder at origin, going DOWN (negative Z)
bpy.ops.mesh.primitive_cylinder_add(
    vertices=8, radius=0.07, depth=0.45,
    location=(0, 0, -0.25)
)
obj = bpy.context.object
obj.name = "Sword"

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_mode(type='FACE')

# Select top face of handle
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
for poly in obj.data.polygons:
    if poly.center.z > 0.01:
        poly.select = True
        break

bpy.ops.object.mode_set(mode='EDIT')

# ── Step 1: Guard crosspiece (wide, thin rectangle) ──
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.02)})
bpy.ops.transform.resize(value=(3.5, 0.25, 1))
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.04)})
bpy.ops.transform.resize(value=(0.5, 0.6, 1))

# ── Step 2: Blade base (full width, straight section) ──
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.2)})

# ── Step 3: Blade mid (still full width) ──
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.25)})

# ── Step 4: Blade upper (slight taper) ──
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.25)})
bpy.ops.transform.resize(value=(0.75, 0.75, 1))

# ── Step 5: Near tip ──
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.2)})
bpy.ops.transform.resize(value=(0.45, 0.45, 1))

# ── Step 6: Tip point ──
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, 0.1)})
bpy.ops.transform.resize(value=(0.05, 0.05, 1))

# ── Flatten blade to sword thinness ──
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
for v in obj.data.vertices:
    if v.co.z > 0.06:
        v.select = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.resize(value=(1, 0.12, 1))

# ── Widen blade in X (sword width) ──
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
for v in obj.data.vertices:
    if v.co.z > 0.06:
        v.select = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.resize(value=(2.5, 1, 1))

# ── Pommel at bottom of handle ──
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
for poly in obj.data.polygons:
    if poly.center.z < -0.22:
        poly.select = True
        break
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.extrude_region_move(TRANSFORM_OT_translate={"value": (0, 0, -0.04)})
bpy.ops.transform.resize(value=(1.6, 1.6, 0.6))

# ── Handle ring wraps ──
# Select an edge loop around handle middle and scale up
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
for v in obj.data.vertices:
    if -0.2 < v.co.z < -0.14 and abs(v.co.x) < 0.08:
        v.select = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.resize(value=(1.15, 1.15, 1))

# ── Bevel ──
bpy.ops.object.mode_set(mode='OBJECT')
obj.modifiers.new('Bevel', 'BEVEL')
obj.modifiers['Bevel'].width = 0.006
obj.modifiers['Bevel'].segments = 2

# ── Battle damage: chip on blade edge ──
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')
for v in obj.data.vertices:
    if 0.3 < v.co.z < 0.45 and v.co.x > 0.08:
        v.select = True
        break
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.transform.translate(value=(-0.04, 0, 0))

# ── Materials ──
bpy.ops.object.mode_set(mode='OBJECT')
obj.data.materials.append(mat_bone)
obj.data.materials.append(mat_blade)
for poly in obj.data.polygons:
    if poly.center.z < 0.06:
        poly.material_index = 0  # bone
    else:
        poly.material_index = 1  # blade

bpy.ops.object.shade_smooth()

bpy.ops.object.mode_set(mode='OBJECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

out = '/mnt/c/project/game/models/output/weapon_junk_sword_v4.blend'
bpy.ops.wm.save_as_mainfile(filepath=out)
print(f"Saved: {out}")
print("DONE: Стон могильщика v4")
