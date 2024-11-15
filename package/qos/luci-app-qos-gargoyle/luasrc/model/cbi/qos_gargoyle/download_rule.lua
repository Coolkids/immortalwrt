-- Copyright 2017 Xingwang Liao <kuoruan@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local wa  = require "luci.tools.webadmin"
local uci = require "luci.model.uci".cursor()
local qos = require "luci.model.qos_gargoyle"
local i18n = require "luci.i18n"

local m, s, o
local sid = arg[1]
local download_classes = {}
local qos_gargoyle = "qos_gargoyle"

uci:foreach(qos_gargoyle, "download_class", function(s)
	local class_alias = s.name
	if class_alias then
		download_classes[#download_classes + 1] = {name = s[".name"], alias = class_alias}
	end
end)

m = Map(qos_gargoyle, i18n.translate("Edit Download Classification Rule"))
m.redirect = luci.dispatcher.build_url("admin/QOS/qos_gargoyle/download")

if not sid or not m.uci:get(qos_gargoyle, sid) then
	luci.http.redirect(m.redirect)
	return
end

s = m:section(NamedSection, sid, "download_rule")
s.anonymous = true
s.addremove = false

o = s:option(ListValue, "class", i18n.translate("Service Class"))
for _, s in ipairs(download_classes) do o:value(s.name, s.alias) end

o = s:option(Value, "proto", i18n.translate("Transport Protocol"))
o:value("", i18n.translate("All"))
o:value("tcp", "TCP")
o:value("udp", "UDP")
o:value("icmp", "ICMP")
o:value("gre", "GRE")
o.write = function(self, section, value)
	Value.write(self, section, value:lower())
end

o = s:option(Value, "family", i18n.translate("Family"))
o:value("any", i18n.translate("All"))
o:value("ipv4", "ipv4")
o:value("ipv6", "ipv6")
o.default = "any"

o = s:option(Value, "source", i18n.translate("Source IP(s)"),
	i18n.translate("Packet's source ip, can optionally have /[mask] after it (see -s option in <br />iptables man page)."))
o:value("", i18n.translate("All"))
wa.cbi_add_knownips(o)
o.datatype = "or(ipmask4, ipmask6)"

o = s:option(Value, "srcport", i18n.translate("Source Port(s)"),
	i18n.translate("Packet's source port, can be a range (eg. 80-90)."))
o:value("", i18n.translate("All"))
o.datatype = "or(port, portrange)"

o = s:option(Value, "destination", i18n.translate("Destination IP(s)"),
	i18n.translate("Packet's destination ip, can optionally have /[mask] after it (see -d option <br />in iptables man page)."))
o:value("", i18n.translate("All"))
wa.cbi_add_knownips(o)
o.datatype = "or(ipmask4, ipmask6)"

o = s:option(Value, "dstport", i18n.translate("Destination Port(s)"),
	i18n.translate("Packet's destination port, can be a range (eg. 80-90)."))
o:value("", i18n.translate("All"))
o.datatype = "or(port, portrange)"

o = s:option(Value, "min_pkt_size", i18n.translate("Minimum Packet Length"),
	i18n.translate("Packet's minimum size (in bytes)."))
o.datatype = "range(1, 1500)"

o = s:option(Value, "max_pkt_size", i18n.translate("Maximum Packet Length"),
	i18n.translate("Packet's maximum size (in bytes)."))
o.datatype = "range(1, 1500)"

o = s:option(Value, "connbytes_kb", i18n.translate("Connection Bytes Reach"),
	i18n.translate("The total size of data transmitted since the establishment of the link (in kBytes)."))
o.datatype = "range(0, 4194303)"

if qos.has_ndpi() then
	o = s:option(ListValue, "ndpi", i18n.translate("DPI Protocol"))
	o:value("", i18n.translate("All"))
	qos.cbi_add_dpi_protocols(o)
end

o = s:option(Value, "test_order", i18n.translate("Priority"),
	i18n.translate("Rule Priority"))
o.datatype = "range(0, 4194303)"
o.default = string.gsub(arg[1], "download_rule_", "")

return m
