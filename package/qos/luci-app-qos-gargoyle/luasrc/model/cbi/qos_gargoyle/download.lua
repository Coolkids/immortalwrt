-- Copyright 2017 Xingwang Liao <kuoruan@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local wa   = require "luci.tools.webadmin"
local uci  = require "luci.model.uci".cursor()
local dsp  = require "luci.dispatcher"
local http = require "luci.http"
local qos  = require "luci.model.qos_gargoyle"
local i18n = require "luci.i18n"

local m, class_s, rule_s, o
local download_classes = {}
local qos_gargoyle = "qos_gargoyle"

local index=0
uci:foreach(qos_gargoyle, "download_class", function(s)
	index = index + 1
	local class_alias = s.name
	if class_alias then
		download_classes[#download_classes + 1] = {name = s[".name"], alias = class_alias}
		local temp = tonumber(string.gsub(s[".name"], "download_class_", ""), 10)
		if temp > index then
			index = temp
		end
	end
end)

local index2=0
uci:foreach(qos_gargoyle, "download_rule", function(s)
	local class_alias = s[".name"]
	if class_alias then
		local temp = tonumber(string.gsub(class_alias, "download_rule_", ""), 10)
		if temp > index2 then
			index2 = temp
		end
	end
end)

m = Map(qos_gargoyle, i18n.translate("Download Settings"))
m.template = "qos_gargoyle/list_view"

class_s = m:section(TypedSection, "download_class", i18n.translate("Service Classes"),
	i18n.translate("Each service class is specified by four parameters: percent bandwidth at <br />capacity, realtime bandwidth and maximum bandwidth and the minimimze round <br />trip time flag.")
	)
class_s.anonymous = true
class_s.addremove = true
class_s.template  = "cbi/tblsection"
class_s.extedit   = dsp.build_url("admin/QOS/qos_gargoyle/download/class/%s")
class_s.create    = function(e, t)
	local uuid  = "download_class_" .. tostring(index + 1)
	t = uuid
	TypedSection.create(e, t)
	http.redirect(class_s.extedit:format(t))
end

o = class_s:option(DummyValue, "name", i18n.translate("Class Name"))
o.cfgvalue = function(...)
	return Value.cfgvalue(...) or i18n.translate("None")
end

o = class_s:option(DummyValue, "percent_bandwidth", i18n.translate("Percent Bandwidth At Capacity"))
o.cfgvalue = function(...)
	local v = tonumber(Value.cfgvalue(...))
	if v and v > 0 then
		return "%d %%" % v
	end
	return i18n.translate("Not set")
end

o = class_s:option(DummyValue, "min_bandwidth", "%s (kbps)" % i18n.translate("Minimum Bandwidth"))
o.cfgvalue = function(...)
	local v = tonumber(Value.cfgvalue(...))
	return v or i18n.translate("Zero")
end

o = class_s:option(DummyValue, "max_bandwidth", "%s (kbps)" % i18n.translate("Maximum Bandwidth"))
o.cfgvalue = function(...)
	local v = tonumber(Value.cfgvalue(...))
	return v or i18n.translate("Unlimited")
end

o = class_s:option(DummyValue, "minRTT", i18n.translate("Minimize RTT"))
o.cfgvalue = function(...)
	local v = Value.cfgvalue(...)
	return v and i18n.translate(v) or i18n.translate("No")
end

o = class_s:option(DummyValue, "_ld", "%s (kbps)" % i18n.translate("Load"))
o.rawhtml = true
o.value   = "<em class=\"ld-download\">*</em>"

rule_s = m:section(TypedSection, "download_rule", i18n.translate("Classification Rules"),
	i18n.translate("Packets are tested against the rules in the order specified -- rules toward <br />the top have priority. As soon as a packet matches a rule it is classified, <br />and the rest of the rules are ignored. The order of the rules can be altered <br />using the arrow controls.")
	)
rule_s.addremove = true
rule_s.sortable  = true
rule_s.anonymous = true
rule_s.template  = "cbi/tblsection"
rule_s.extedit   = dsp.build_url("admin/QOS/qos_gargoyle/download/rule/%s")
rule_s.create    = function(e, t)
	local uuid  = "download_rule_" .. tostring(index2 + 1)
	t = uuid
	TypedSection.create(e, t)
	http.redirect(rule_s.extedit:format(t))
end

o = rule_s:option(ListValue, "class", i18n.translate("Service Class"))
for _, s in ipairs(download_classes) do o:value(s.name, s.alias) end

o = rule_s:option(Value, "proto", i18n.translate("Transport Protocol"))
o:value("", i18n.translate("All"))
o:value("tcp", "TCP")
o:value("udp", "UDP")
o:value("icmp", "ICMP")
o:value("gre", "GRE")

o.cfgvalue = function(...)
	local v = Value.cfgvalue(...)
	return v and v:upper() or ""
end
o.write = function(self, section, value)
	Value.write(self, section, value:lower())
end

o = rule_s:option(Value, "family", i18n.translate("Family"))
o:value("any", i18n.translate("All"))
o:value("ipv4", "ipv4")
o:value("ipv6", "ipv6")
o.default = "any"

o = rule_s:option(Value, "source", i18n.translate("Source IP(s)"))
o:value("", i18n.translate("All"))
wa.cbi_add_knownips(o)
o.datatype = "or(ipmask4, ipmask6)"

o = rule_s:option(Value, "srcport", i18n.translate("Source Port(s)"))
o:value("", i18n.translate("All"))
o.datatype  = "or(port, portrange)"

o = rule_s:option(Value, "destination", i18n.translate("Destination IP(s)"))
o:value("", i18n.translate("All"))
wa.cbi_add_knownips(o)
o.datatype = "or(ipmask4, ipmask6)"

o = rule_s:option(Value, "dstport", i18n.translate("Destination Port(s)"))
o:value("", i18n.translate("All"))
o.datatype = "or(port, portrange)"

o = rule_s:option(DummyValue, "min_pkt_size", i18n.translate("Minimum Packet Length"))
o.cfgvalue = function(...)
	local v = tonumber(Value.cfgvalue(...))
	if v and v > 0 then
		return wa.byte_format(v)
	end
	return i18n.translate("Not set")
end

o = rule_s:option(DummyValue, "max_pkt_size", i18n.translate("Maximum Packet Length"))
o.cfgvalue = function(...)
	local v = tonumber(Value.cfgvalue(...))
	if v and v > 0 then
		return wa.byte_format(v)
	end
	return i18n.translate("Not set")
end

o = rule_s:option(DummyValue, "connbytes_kb", i18n.translate("Connection Bytes Reach"))
o.cfgvalue = function(...)
	local v = tonumber(Value.cfgvalue(...))
	if v and v > 0 then
		return wa.byte_format(v * 1024)
	end
	return i18n.translate("Not set")
end

if qos.has_ndpi() then
	o = rule_s:option(DummyValue, "ndpi", i18n.translate("DPI Protocol"))
	o.cfgvalue = function(...)
		local v = Value.cfgvalue(...)
		return v or i18n.translate("All")
	end
	
end

o = rule_s:option(Value, "test_order", i18n.translate("Priority"))
o.datatype = "range(0, 4194303)"

return m
