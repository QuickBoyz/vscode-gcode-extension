%
; Multi-tool 3D contour — exercises tool changes, Z-ramping, rapid/feed colour split
G21 G90 G54
T01 M06
M03 S3000

; ── Roughing pass — Z-ramp pocket ─────────────────────────────────────
G00 Z10.0
G00 X0.0 Y0.0

; Helical Z-ramp into pocket (rapid approach + feed ramp)
G00 X10.0 Y10.0
G00 Z0.5
G01 Z-1.0 F150
G01 X60.0 F600
G01 Y40.0
G01 X10.0
G01 Y10.0

G01 Z-2.0 F150
G01 X60.0 F600
G01 Y40.0
G01 X10.0
G01 Y10.0

G01 Z-3.0 F150
G01 X60.0 F600
G01 Y40.0
G01 X10.0
G01 Y10.0

; ── Arc passes ────────────────────────────────────────────────────────
G00 Z1.0
G00 X35.0 Y25.0
G01 Z-1.5 F150
G02 X35.0 Y25.0 I20.0 J0.0 F400

G01 Z-3.0 F150
G02 X35.0 Y25.0 I20.0 J0.0 F400

; ── Tool change — finishing pass ──────────────────────────────────────
G00 Z10.0
T02 M06
M03 S4500

G00 X10.0 Y10.0
G01 Z-3.5 F100
G01 X60.0 F300
G01 Y40.0
G01 X10.0
G01 Y10.0

; Diagonal finish pass
G01 X60.0 Y40.0 F300
G00 Z10.0
G00 X0.0 Y40.0
G01 Z-3.5 F100
G01 X60.0 Y10.0 F300

G00 Z10.0
M05
M30
%
