-- Copyright 2017 Xingwang Liao <kuoruan@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local sys = require "luci.sys"
local uci = require "luci.model.uci".cursor()
local net = require "luci.model.network".init()
local qos = require "luci.model.qos_gargoyle"

local m, s, o, global
local upload_classes = {}
local download_classes = {}
local qos_gargoyle = "qos_gargoyle"

local function qos_enabled()
	return sys.init.enabled(qos_gargoyle)
end

uci:foreach(qos_gargoyle, "upload_class", function(s)
	local class_alias = s.name
	if class_alias then
		upload_classes[#upload_classes + 1] = {name = s[".name"], alias = class_alias}
	end
end)

uci:foreach(qos_gargoyle, "download_class", function(s)
	local class_alias = s.name
	if class_alias then
		download_classes[#download_classes + 1] = {name = s[".name"], alias = class_alias}
	end
end)

m = Map(qos_gargoyle, translate("Gargoyle QoS"),
	translate("Quality of Service (QoS) provides a way to control how available bandwidth is allocated.")
	)

global = m:section(NamedSection, "global", "global", translate("Global Settings"))
global.anonymous = true

o = global:option(Button, "enable", nil, translate("QoS Switch"))
o.render = function(self, section, scope)
	if qos_enabled() then
		self.title = translate("Disable QoS")
		self.inputstyle = "reset"
	else
		self.title = translate("Enable QoS")
		self.inputstyle = "apply"
	end
	Button.render(self, section, scope)
end
o.write = function(self, section, value)
	if qos_enabled() then
		sys.init.stop(qos_gargoyle)
		sys.init.disable(qos_gargoyle)
		Value.write(self, section, 'false')
	else
		sys.init.enable(qos_gargoyle)
		sys.init.start(qos_gargoyle)
		Value.write(self, section, 'true')
	end
end

local apply = luci.http.formvalue("cbi.apply")
if apply and qos_enabled() then
	sys.init.stop(qos_gargoyle)
	sys.init.start(qos_gargoyle)
end

o = global:option(ListValue, "wan", translate("WAN Interface"))
o:value(0, "pppoe-wan")
local wa = require "luci.tools.webadmin"
wa.cbi_add_networks(o)
o.default = 0
o.rmempty = false

s = m:section(NamedSection, "upload", "upload", translate("Upload Settings"))
s.anonymous = true

o = s:option(ListValue, "default_class", translate("Default Service Class"),
	translate("Specifie how packets that do not match any rule should be classified."))
for _, s in ipairs(upload_classes) do o:value(s.name, s.alias) end

o = s:option(Value, "total_bandwidth", translate("Total Upload Bandwidth"),
	translate("Should be set to around 98% of your available upload bandwidth. Entering a <br />number which is too high will result in QoS not meeting its class <br />requirements. Entering a number which is too low will needlessly penalize <br />your upload speed. You should use a speed test program (with QoS off) to <br />determine available upload bandwidth. Note that bandwidth is specified in <br />kbps, leave blank to disable update QoS. There are 8 kilobits per kilobyte.<br />")
	)
o.datatype = "uinteger"

s = m:section(NamedSection, "download", "download", translate("Download Settings"))
s.anonymous = true

o = s:option(ListValue, "default_class", translate("Default Service Class"),
	translate("Specifie how packets that do not match any rule should be classified."))
for _, s in ipairs(download_classes) do o:value(s.name, s.alias) end

o = s:option(Value, "total_bandwidth", translate("Total Download Bandwidth"),
	translate("Specifying correctly is crucial to making QoS work. Note that bandwidth is <br />specified in kbps, leave blank to disable download QoS. There are 8 kilobits <br />per kilobyte.")
	)
o.datatype = "uinteger"

o = s:option(Flag, "qos_monenabled", translate("Enable Active Congestion Control"),
	translate("<p>The active congestion control (ACC) observes your download activity and <br />automatically adjusts your download link limit to maintain proper QoS <br />performance. ACC automatically compensates for changes in your ISP's <br />download speed and the demand from your network adjusting the link speed to <br />the highest speed possible which will maintain proper QoS function. The <br />effective range of this control is between 15% and 100% of the total <br />download bandwidth you entered above.</p>") ..
	translate("<p>While ACC does not adjust your upload link speed you must enable and <br />properly configure your upload QoS for it to function properly.</p>")
	)
o.enabled  = "true"
o.disabled = "false"

o = s:option(Value, "ptarget_ip", translate("Use Non-standard Ping Target"),
	translate("The segment of network between your router and the ping target is where <br />congestion is controlled. By monitoring the round trip ping times to the <br />target congestion is detected. By default ACC uses your WAN gateway as the <br />ping target. If you know that congestion on your link will occur in a <br />different segment then you can enter an alternate ping target. Leave empty <br />to use the default settings.")
	)
o:depends("qos_monenabled", "true")
o:value("223.5.5.5")
o.datatype = "ipaddr"

o = s:option(Value, "pinglimit", translate("Manual Ping Limit"),
	translate("Round trip ping times are compared against the ping limits. ACC controls the <br />link limit to maintain ping times under the appropriate limit. By default <br />ACC attempts to automatically select appropriate target ping limits for you <br />based on the link speeds you entered and the performance of your link it <br />measures during initialization. You cannot change the target ping time for <br />the minRTT mode but by entering a manual time you can control the target <br />ping time of the active mode. The time you enter becomes the increase in the <br />target ping time between minRTT and active mode. Leave empty to use the <br />default settings.")
	)
o:depends("qos_monenabled", "true")
o:value("Auto", translate("Auto"))
o.datatype = "or('Auto', range(10, 250))"

return m
