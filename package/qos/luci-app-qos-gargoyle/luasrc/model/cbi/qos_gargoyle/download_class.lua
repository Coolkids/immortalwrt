-- Copyright 2017 Xingwang Liao <kuoruan@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local m, s, o
local sid = arg[1]
local qos_gargoyle = "qos_gargoyle"
local i18n = require "luci.i18n"

m = Map(qos_gargoyle, i18n.translate("Edit Download Service Class"))
m.redirect = luci.dispatcher.build_url("admin/QOS/qos_gargoyle/download")

if not sid or not m.uci:get(qos_gargoyle, sid) then
	luci.http.redirect(m.redirect)
	return
end

s = m:section(NamedSection, sid, "download_class")
s.anonymous = true
s.addremove = false

o = s:option(Value, "name", i18n.translate("Service Class Name"))
o.rmempty = false

o = s:option(Value, "percent_bandwidth", i18n.translate("Percent Bandwidth At Capacity"),
	i18n.translate("The percentage of the total available bandwidth that should be allocated to <br />this class when all available bandwidth is being used. If unused bandwidth <br />is available, more can (and will) be allocated. The percentages can be <br />configured to equal more (or less) than 100, but when the settings are <br />applied the percentages will be adjusted proportionally so that they add to <br />100. This setting only comes into effect when the WAN link is saturated.<br />"))
o.datatype = "range(1, 100)"
o.rmempty  = false

o = s:option(Value, "min_bandwidth", i18n.translate("Minimum Bandwidth"),
	i18n.translate("The minimum service this class will be allocated when the link is at <br />capacity. Classes which specify minimum service are known as realtime <br />classes by the active congestion controller. Streaming video, VoIP and <br />interactive online gaming are all examples of applications that must have a <br />minimum bandwith to function. To determine what to enter use the application <br />on an unloaded LAN and observe how much bandwidth it uses. Then enter a <br />number only slightly higher than this into this field. QoS will satisfiy the <br />minimum service of all classes first before allocating to other waiting <br />classes so be careful to use minimum bandwidths sparingly."))
o:value("0", i18n.translate("Zero"))
o.datatype = "uinteger"
o.default  = "0"

o = s:option(Value, "max_bandwidth", i18n.translate("Maximum Bandwidth"),
	i18n.translate("The maximum amount of bandwidth this class will be allocated in kbit/s. Even <br />if unused bandwidth is available, this service class will never be permitted <br />to use more than this amount of bandwidth."))
o:value("", i18n.translate("Unlimited"))
o.datatype = "uinteger"

o = s:option(Flag, "minRTT", i18n.translate("Minimize RTT"),
	i18n.translate("Indicates to the active congestion controller that you wish to minimize <br />round trip times (RTT) when this class is active. Use this setting for <br />online gaming or VoIP applications that need low round trip times (ping <br />times). Minimizing RTT comes at the expense of efficient WAN throughput so <br />while these class are active your WAN throughput will decline (usually <br />around 20%)."))
o.enabled  = "Yes"
o.disabled = "No"

return m
