%
; Simple 3D toolpath for visualizer showcase
G21 G90 G54
M03 S2000

; Approach
G00 Z5.0
G00 X0.0 Y0.0
G00 Z0.5

; Rectangular contour at Z0
G01 Z-1.0 F200
G01 X50.0 F500
G01 Y30.0
G01 X0.0
G01 Y0.0

; Step down and repeat
G00 Z0.5
G01 Z-2.0 F200
G01 X50.0 F500
G01 Y30.0
G01 X0.0
G01 Y0.0

; Diagonal cross
G00 Z0.5
G01 Z-1.5 F200
G01 X50.0 Y30.0 F500
G00 Z0.5
G00 X0.0 Y30.0
G01 Z-1.5 F200
G01 X50.0 Y0.0 F500

; Retract
G00 Z5.0
M05
M30
%
