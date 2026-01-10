#<counter>=0
#<var>=10
#<result>=[#<counter>+#<var>]
WHILE [#<counter> LT 100] DO
  #<counter>=[#<counter>+1]
  G1 X[#<counter>] Y[#<var>]
END
M30

