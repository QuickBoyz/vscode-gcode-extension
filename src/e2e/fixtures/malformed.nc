; Deliberately malformed G-code fixture used by the visualizer e2e
; error-path test (#142). The IF without THEN should trip the LinuxCNC
; parser's structured-keyword check and produce a VisualizerFailure
; that reaches the webview error overlay.
G0 X0 Y0 Z0
o100 IF [1 GT
  G1 X10
o100 ENDIF
