#<counter>=0
#<var>=10
#<result>=[#<counter>+#<var>]
WHILE [#<counter> LT 100] DO
  #<counter>=[#<counter>+1]
  G0 X[#<counter>] Y[#<result>]
END
M30

