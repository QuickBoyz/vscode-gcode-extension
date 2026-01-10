%
G21 G90 G54
M03 S1000.0

#<counter> = 0.0
WHILE [#<counter> LT 10.0] DO
  
  (ERROR: Expected OSUB)
  G00 X[#<counter> * 10.0]
  (ERROR: Unexpected token ENDIF)
  
  #<counter> = #<counter> + 1.0
END

M05
M30
%