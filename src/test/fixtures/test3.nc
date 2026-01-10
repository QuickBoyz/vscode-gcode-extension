%
G21 G90 G54 G17

(T1 M6)

#<depth>=-17
#<x_spacing>=50
#<y_spacing>=50
#<start_x>=20
#<start_y>=20
#<col_count>=0
#<row_count>=0
#<clearance>=10
#<plunge_feed>=300
#<feed>=1000
#<cols>=12
#<rows>=12
#<diameter>=10.5
#<tool_diameter>=#5410
#<step_down>=2

o100 while [#<row_count> LT #<rows>]

  #<ypos> = [#<start_y> + #<row_count> * #<y_spacing>]
  #<col_count> = 0

  o110 while [#<col_count> LT #<cols>] 

    #<xpos> = [#<start_x> + #<col_count> * #<x_spacing>]
    #<tool_center_radius> = [[#<diameter> - #<tool_diameter>] / 2]

    G00 X[#<xpos> - #<tool_center_radius>] Y#<ypos>
    G00 Z#<clearance>
    G01 Z0 F#<plunge_feed>

    G02 X[#<xpos> - #<tool_center_radius>] Y#<ypos> Z#<depth> P[ABS[FUP[#<depth> / #<step_down>]]] I[#<tool_center_radius>] J0 F#<feed>
    G02 X[#<xpos> - #<tool_center_radius>] Y#<ypos> Z#<depth> I[#<tool_center_radius>] J0 F#<feed>

    G00 Z#<clearance>

    #<col_count> = [#<col_count> + 1]

  o110 endwhile

  #<row_count> = [#<row_count> + 1]

o100 endwhile

G00 Z#<clearance>
M30
%