-- Copyright 2017 Xingwang Liao <kuoruan@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local wa  = require "luci.tools.webadmin"
local uci = require "luci.model.uci".cursor()
local qos = require "luci.model.qos_gargoyle"

local m, s, o
local sid = arg[1]
local upload_classes = {}
local qos_gargoyle = "qos_gargoyle"

uci:foreach(qos_gargoyle, "upload_class", function(s)
	local class_alias = s.name
	if class_alias then
		upload_classes[#upload_classes + 1] = {name = s[".name"], alias = class_alias}
	end
end)
	
m = Map(qos_gargoyle, translate("Edit Upload Classification Rule"))
m.redirect = luci.dispatcher.build_url("admin/QOS/qos_gargoyle/upload")

if not sid or not m.uci:get(qos_gargoyle, sid) then
	luci.http.redirect(m.redirect)
	return
end

s = m:section(NamedSection, sid, "upload_rule", "")
s.addremove = false
s.dynamic = false

o = s:option(ListValue, "class", translate("Service Class"))
for _, s in ipairs(upload_classes) do o:value(s.name, s.alias) end

o = s:option(Value, "proto", translate("Transport Protocol"))
o:value("", translate("All"))
o:value("tcp", "TCP")
o:value("udp", "UDP")
o:value("icmp", "ICMP")
o:value("gre", "GRE")
o.write = function(self, section, value)
	Value.write(self, section, value:lower())
end

o = s:option(Value, "family", translate("Family"))
o:value("any", translate("All"))
o:value("ipv4", "ipv4")
o:value("ipv6", "ipv6")
o.default = "any"

o = s:option(Value, "source", translate("Source IP(s)"),
	translate("Packet's source ip, can optionally have /[mask] after it (see -s option in <br />iptables man page)."))
o:value("", translate("All"))
wa.cbi_add_knownips(o)
o.datatype = "or(ipmask4, ipmask6)"

o = s:option(Value, "srcport", translate("Source Port(s)"),
	translate("Packet's source port, can be a range (eg. 80-90)."))
o:value("", translate("All"))
o.datatype = "or(port, portrange)"

o = s:option(Value, "destination", translate("Destination IP(s)"),
	translate("Packet's destination ip, can optionally have /[mask] after it (see -d option <br />in iptables man page)."))
o:value("", translate("All"))
wa.cbi_add_knownips(o)
o.datatype = "or(ipmask4, ipmask6)"

o = s:option(Value, "dstport", translate("Destination Port(s)"),
	translate("Packet's destination port, can be a range (eg. 80-90)."))
o:value("", translate("All"))
o.datatype = "or(port, portrange)"

o = s:option(Value, "min_pkt_size", translate("Minimum Packet Length"),
	translate("Packet's minimum size (in bytes)."))
o.datatype = "range(1, 1500)"

o = s:option(Value, "max_pkt_size", translate("Maximum Packet Length"),
	translate("Packet's maximum size (in bytes)."))
o.datatype = "range(1, 1500)"

o = s:option(Value, "connbytes_kb", translate("Connection Bytes Reach"),
	translate("The total size of data transmitted since the establishment of the link (in kBytes)."))
o.datatype = "range(0, 4194303)"

if qos.has_ndpi() then
	o = s:option(ListValue, "ndpi", translate("DPI Protocol"))
	o:value("", translate("All"))
	qos.cbi_add_dpi_protocols(o)
end

o = s:option(Value, "test_order", translate("Priority"),
	translate("Rule Priority"))
o.datatype = "range(0, 4194303)"
o.default = string.gsub(arg[1], "upload_rule_", "")

return m
