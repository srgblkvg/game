"""
Стон могильщика — junk weapon, single coherent mesh.
Low-poly dark fantasy: chipped blade + bone handle as one object.
"""
import bpy
import math
import sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, setup_scene, COLORS

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

# ── Scene first ──
setup_scene()

# Camera closer for single item
for cam in bpy.data.objects:
    if cam.type == 'CAMERA':
        cam.location = (0, -2.5, 1.2)
        cam.rotation_euler = (math.radians(70), 0, 0)

# ── Materials ──
mat_rust = make_material("RustIron", COLORS["rust_iron"], roughness=0.8, metallic=0.75)
mat_bone = make_material("OldBone", COLORS["old_bone"], roughness=0.55)
mat_blood = make_material("DriedBlood", COLORS["dried_blood"], roughness=0.9)

# ── Build from scratch: start with a cube, extrude the blade ──
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
obj = bpy.context.object
obj.name = "Sword"

# Go to edit, remove all faces, rebuild
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.delete(type='VERT')

# ── Create profile vertices for guard area (center) ──
# We'll build a 2D profile in XZ then extrude in Y for thickness
bpy.ops.mesh.primitive_grid_add(x_subdivisions=1, y_subdivisions=8, size=1, location=(0, 0, 0))
obj = bpy.context.object
obj.name = "Sword"

# Scale to blade profile
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.transform.resize(value=(0.12, 0.03, 1.5))

# Now we have a flat grid. Let's shape it:
# Move top vertices to a point (tip), widen near bottom

bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

mesh = obj.data
# Taper top to tip
for v in mesh.vertices:
    # Tip: shrink to point
    if v.co.z > 0.95:
        v.co.x *= 0.1
        v.co.y *= 0.1
    # Blade body: slight curve
    elif v.co.z > 0.2:
        v.co.x *= (1.0 - (v.co.z - 0.2) * 0.3)
    # Guard area: wider
    elif -0.1 < v.co.z < 0.2:
        v.co.x *= 1.0
    # Handle: narrower
    elif v.co.z < -0.1:
        if abs(v.co.z) < 0.6:
            v.co.x *= 0.4
        else:
            v.co.x *= 0.5

# Add bevel for worn edges
bpy.ops.object.mode_set(mode='OBJECT')
obj.modifiers.new('Bevel', 'BEVEL')
obj.modifiers['Bevel'].width = 0.008
obj.modifiers['Bevel'].segments = 2
bpy.ops.object.modifier_apply(modifier='Bevel')

# Add subdivision for smoothness
obj.modifiers.new('Subsurf', 'SUBSURF')
obj.modifiers['Subsurf'].levels = 2
obj.modifiers['Subsurf'].render_levels = 2
bpy.ops.object.modifier_apply(modifier='Subsurf')

# ── Chip the blade edge ──
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# Find and delete a few faces on the blade edge for battle damage
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_mode(type='VERT')
bpy.ops.mesh.select_all(action='DESELECT')

for v in mesh.vertices:
    if 0.4 < v.co.z < 0.7 and v.co.x > 0.04:
        v.select = True
        break

# Move the chipped vertex inward
bpy.ops.transform.translate(value=(-0.04, 0, 0))
bpy.ops.mesh.select_all(action='DESELECT')

# Another chip lower on the blade
for v in mesh.vertices:
    if 0.15 < v.co.z < 0.35 and v.co.x > 0.03:
        v.select = True
        break
bpy.ops.transform.translate(value=(-0.03, -0.01, 0))

# ── Handle wrapping (extrude rings from existing geometry) ──
# Select edge loops on the handle and scale up slightly for bone ridges
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# ── Assign materials by selection ──
# Blade portion (z > -0.15): rust
# Handle portion (z < -0.15): bone
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_mode(type='FACE')
bpy.ops.mesh.select_all(action='DESELECT')

bpy.ops.object.mode_set(mode='OBJECT')
obj.data.materials.append(mat_rust)
obj.data.materials.append(mat_bone)
obj.data.materials.append(mat_blood)

for poly in mesh.polygons:
    center = poly.center
    if center.z > -0.15:
        poly.material_index = 0  # rust blade
    else:
        poly.material_index = 1  # bone handle

# ── Blood stain: small mesh on blade ──
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.mesh.primitive_plane_add(size=1, location=(0.035, 0.005, 0.3))
stain = bpy.context.object
stain.name = "BloodStain"
stain.rotation_euler = (math.radians(90), math.radians(90), 0)
stain.scale = (0.2, 0.06, 1)
stain.modifiers.new('Subsurf', 'SUBSURF')
stain.modifiers['Subsurf'].levels = 1
bpy.ops.object.modifier_apply(modifier='Subsurf')
stain.data.materials.append(mat_blood)

# Parent blood stain to sword
stain.parent = obj

# ── Smooth shading ──
bpy.ops.object.select_all(action='SELECT')
for o in bpy.context.selected_objects:
    bpy.ops.object.shade_smooth()

# ── Save ──
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

out = '/mnt/c/project/game/models/output/weapon_junk_sword_v2.blend'
bpy.ops.wm.save_as_mainfile(filepath=out)
print(f"Saved: {out}")
