%
; Hero shot fixture — side-by-side editor + visualizer showcase
; Combines named variables, loops, arcs, and tool changes for visual richness
G21 G90 G54

; ── Variable setup ────────────────────────────────────────────────────
#<depth>         = -2.5
#<feed_rough>    = 600.0
#<feed_finish>   = 300.0
#<center_x>      = 40.0
#<center_y>      = 30.0
#<radius_outer>  = 25.0
#<radius_inner>  = 12.0

; ── Roughing tool ─────────────────────────────────────────────────────
T01 M06
M03 S2500

G00 Z5.0
G00 X[#<center_x> - #<radius_outer>] Y#<center_y>
G01 Z[#<depth>] F200

; Outer circle
G02 X[#<center_x> - #<radius_outer>] Y#<center_y> I#<radius_outer> J0.0 F[#<feed_rough>]

; Cross passes
G01 X[#<center_x> + #<radius_outer>] F[#<feed_rough>]
G00 Z1.0
G00 X#<center_x> Y[#<center_y> - #<radius_outer>]
G01 Z[#<depth>] F200
G01 Y[#<center_y> + #<radius_outer>] F[#<feed_rough>]

; ── Finishing tool ────────────────────────────────────────────────────
G00 Z5.0
T02 M06
M03 S4000

G00 X[#<center_x> - #<radius_inner>] Y#<center_y>
G01 Z[#<depth>] F150

; Inner circle
G02 X[#<center_x> - #<radius_inner>] Y#<center_y> I#<radius_inner> J0.0 F[#<feed_finish>]

G00 Z5.0
M05
M30
%
