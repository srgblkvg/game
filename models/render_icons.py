"""
Icon renderer for MMO Arena equipment.
Renders items as 2D icons (128x128) with consistent lighting.
"""
import bpy, math, os, sys
sys.path.append('/mnt/c/project/game/models')
from dark_fantasy_style import make_material, COLORS

OUT = '/mnt/c/project/game/models/icons'

def icon_scene():
    """Set up icon rendering: camera, lighting, materials."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # Render settings
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.render.resolution_x = 128
    bpy.context.scene.render.resolution_y = 128
    bpy.context.scene.render.film_transparent = True
    
    # Camera - front view, centered
    bpy.ops.object.camera_add(location=(0, -2.2, 0.2))
    cam = bpy.context.object
    cam.rotation_euler = (math.radians(85), 0, 0)
    bpy.context.scene.camera = cam
    
    # Key light - warm from upper right
    bpy.ops.object.light_add(type='SUN', location=(3, -1, 4))
    sun = bpy.context.object
    sun.data.energy = 4
    sun.data.color = (1.0, 0.9, 0.75)
    
    # Fill light - cool from left
    bpy.ops.object.light_add(type='AREA', location=(-2, 0, 1))
    fill = bpy.context.object
    fill.data.energy = 80
    fill.data.color = (0.4, 0.45, 0.6)
    
    # Rim light - from behind
    bpy.ops.object.light_add(type='POINT', location=(0, 2, 1.5))
    rim = bpy.context.object
    rim.data.energy = 40
    rim.data.color = (0.5, 0.4, 0.3)
    
    # World background = fully transparent
    world = bpy.data.worlds.new("IconWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0, 0, 0, 0)
    bpy.context.scene.world = world


def render_icon(name):
    """Render current scene to PNG."""
    path = os.path.join(OUT, f'{name}.png')
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"  Icon: {path}")
    return path


# ──────────────────────────────────────────────
# ITEM 1: Скорбный капюшон (junk helmet)
# ──────────────────────────────────────────────
icon_scene()

mat_cloth = make_material("Cloth", COLORS["torn_cloth"], roughness=0.9)
mat_bone  = make_material("Bone",  COLORS["old_bone"], roughness=0.6)

# Hood shape: deformed sphere
bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.65, location=(0, 0, 0.55))
hood = bpy.context.object
hood.name = "Hood"

for v in hood.data.vertices:
    if v.co.z < 0.2:
        v.co.z *= 0.5
    v.co.z *= 1.4
    v.co.x *= 0.8

# Tear at bottom-right
bpy.ops.object.mode_set(mode='OBJECT')
for poly in hood.data.polygons:
    if poly.center.z < 0.3 and poly.center.x > 0.15:
        poly.select = True
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.delete(type='FACE')
bpy.ops.object.mode_set(mode='OBJECT')

# Subdivide once for fabric detail
hood.modifiers.new('Subsurf', 'SUBSURF')
hood.modifiers['Subsurf'].levels = 1
bpy.ops.object.modifier_apply(modifier='Subsurf')

hood.data.materials.append(mat_cloth)
bpy.ops.object.shade_smooth()

render_icon('helmet_junk_hod')

# ──────────────────────────────────────────────
# ITEM 2: Стон могильщика (junk weapon)
# ──────────────────────────────────────────────
icon_scene()

mat_rust = make_material("Rust", COLORS["rust_iron"], roughness=0.7, metallic=0.7)
mat_bone2 = make_material("Bone2", COLORS["old_bone"], roughness=0.5)
mat_blood = make_material("Blood", COLORS["dried_blood"], roughness=0.9)

# Sword body: cube → tapered blade
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
sword = bpy.context.object
sword.name = "Sword"
sword.scale = (0.1, 0.025, 0.8)

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_mode(type='VERT')
bpy.ops.mesh.select_all(action='DESELECT')
bpy.ops.object.mode_set(mode='OBJECT')

# Taper to tip
for v in sword.data.vertices:
    if v.co.z > 0.3:
        v.co.x *= 0.2
        v.co.y *= 0.3

bpy.ops.object.mode_set(mode='OBJECT')
sword.data.materials.append(mat_rust)
bpy.ops.object.shade_smooth()

# Blood stain on blade
bpy.ops.mesh.primitive_plane_add(size=0.25, location=(0.03, 0.005, 0.1))
stain = bpy.context.object
stain.name = "Blood"
stain.rotation_euler = (math.radians(90), math.radians(90), 0)
stain.data.materials.append(mat_blood)

# Handle
bpy.ops.mesh.primitive_cylinder_add(radius=0.05, depth=0.22, location=(0, 0, -0.55))
handle = bpy.context.object
handle.name = "Handle"
handle.data.materials.append(mat_bone2)
bpy.ops.object.shade_smooth()

# Guard
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.32))
guard = bpy.context.object
guard.name = "Guard"
guard.scale = (0.22, 0.025, 0.04)
guard.rotation_euler = (0, 0, math.radians(10))
guard.data.materials.append(mat_bone2)

render_icon('weapon_junk_sword')

# ──────────────────────────────────────────────
# ITEM 3: Гробовая преграда (junk shield)
# ──────────────────────────────────────────────
icon_scene()

mat_wood = make_material("Wood", COLORS["rotten_wood"], roughness=0.95)
mat_iron = make_material("Iron", COLORS["tarnished_iron"], roughness=0.6, metallic=0.8)

# Shield body: coffin-shaped (tall box)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
shield = bpy.context.object
shield.name = "Shield"
shield.scale = (0.35, 0.03, 0.5)

# Taper top to coffin shape
for v in shield.data.vertices:
    if v.co.z > 0.3:
        v.co.x *= 0.7

# Iron band across center
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.02, 0))
band = bpy.context.object
band.name = "Band"
band.scale = (0.37, 0.01, 0.04)
band.data.materials.append(mat_iron)

# Vertical iron strips
for x in [-0.08, 0.08]:
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, 0.02, 0))
    strip = bpy.context.object
    strip.name = f"Strip_{x}"
    strip.scale = (0.01, 0.01, 0.4)
    strip.data.materials.append(mat_iron)

shield.data.materials.append(mat_wood)
bpy.ops.object.shade_smooth()

render_icon('shield_junk_coffin')

print("\n=== ALL ICONS RENDERED ===")
