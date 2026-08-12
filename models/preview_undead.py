import bpy, math

bpy.ops.wm.open_mainfile(filepath='/mnt/c/project/game/models/undead-weapons.blend')

# Hide non-weapon meshes
for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.name not in ('KingdomCrossbow', 'KingdomHammer', 'KingdomPolearm', 'KingdomShortsword', 'Skull.002', 'Skull.006'):
        obj.hide_render = True
        obj.hide_viewport = True

# Arrange weapons in a line
weapons = ['KingdomShortsword', 'KingdomHammer', 'KingdomPolearm', 'KingdomCrossbow']
for i, name in enumerate(weapons):
    obj = bpy.data.objects.get(name)
    if obj:
        obj.location.x = (i - 1.5) * 0.6
        obj.location.y = 0
        obj.location.z = 0
        obj.select_set(True)

# Camera
bpy.ops.object.camera_add(location=(0, -3.5, 1.2))
cam = bpy.context.object
cam.rotation_euler = (math.radians(75), 0, 0)
bpy.context.scene.camera = cam

# Lighting
bpy.ops.object.light_add(type='SUN', location=(5, -5, 6))
bpy.context.object.data.energy = 3
bpy.context.object.data.color = (1.0, 0.9, 0.75)

bpy.ops.object.light_add(type='AREA', location=(-2, 1, 1.5))
bpy.context.object.data.energy = 100
bpy.context.object.data.color = (0.4, 0.45, 0.6)

# Render settings
bpy.context.scene.render.engine = 'BLENDER_EEVEE'
bpy.context.scene.render.resolution_x = 800
bpy.context.scene.render.resolution_y = 400
bpy.context.scene.render.filepath = '/mnt/c/project/game/models/icons/undead_preview.png'
bpy.context.scene.render.film_transparent = False

# Dark background
world = bpy.data.worlds.new("PreviewWorld")
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.05, 0.05, 0.08, 1.0)
bpy.context.scene.world = world

bpy.ops.render.render(write_still=True)
print("Preview rendered")
