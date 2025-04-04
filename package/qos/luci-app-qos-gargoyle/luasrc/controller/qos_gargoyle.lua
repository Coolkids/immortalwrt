-- Copyright 2017 Xingwang Liao <kuoruan@gmail.com>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.qos_gargoyle", package.seeall)

local util = require "luci.util"
local http = require "luci.http"
local ntm = require "luci.model.network".init()

local wan
local rv = {}

if pcall(function() local x = ntm:get_all_wan_networks(); local y = ntm:get_all_wan6_networks(); end) then
    wan = ntm:get_all_wan_networks()
elseif pcall(function() local x = ntm:get_wan_networks(); local y = ntm:get_wan6_networks(); end) then
    wan = ntm:get_wan_networks()
elseif pcall(function() local x = ntm:get_wannet(); local y = ntm:get_wan6net(); end) then
    wan = {}
    wan[1] =  ntm:get_wannet()
end

if wan then
    rv.wan = {}
    for i = 1, #wan do
        rv.wan[i] = {
            ipaddr  = wan[i]:ipaddr(),
            gwaddr  = wan[i]:gwaddr(),
            netmask = wan[i]:netmask(),
            dns     = wan[i]:dnsaddrs(),
            expires = wan[i]:expires(),
            uptime  = wan[i]:uptime(),
            proto   = wan[i]:proto(),
            ifname  = wan[i]:ifname()
        }
    end
end

--luci.util.perror(rv.wan[1].ipaddr)
--luci.util.perror(rv.wan[1].ifname)

function index()
    if not nixio.fs.access("/etc/config/qos_gargoyle") then
        return
    end

    entry({"admin","QOS"}, firstchild(), "QOS", 85).dependent = false
    entry({"admin", "QOS", "qos_gargoyle"},
        firstchild(), _("Gargoyle QoS"), 60)

    entry({"admin", "QOS", "qos_gargoyle", "global"},
        cbi("qos_gargoyle/global"), _("Global Settings"), 10)

    entry({"admin", "QOS", "qos_gargoyle", "upload"},
        cbi("qos_gargoyle/upload"), _("Upload Settings"), 20)

    entry({"admin", "QOS", "qos_gargoyle", "upload", "class"},
        cbi("qos_gargoyle/upload_class")).leaf = true

    entry({"admin", "QOS", "qos_gargoyle", "upload", "rule"},
        cbi("qos_gargoyle/upload_rule")).leaf = true

    entry({"admin", "QOS", "qos_gargoyle", "download"},
        cbi("qos_gargoyle/download"), _("Download Settings"), 30)

    entry({"admin", "QOS", "qos_gargoyle", "download", "class"},
        cbi("qos_gargoyle/download_class")).leaf = true

    entry({"admin", "QOS", "qos_gargoyle", "download", "rule"},
        cbi("qos_gargoyle/download_rule")).leaf = true

    entry({"admin", "QOS", "qos_gargoyle", "troubleshooting"},
        template("qos_gargoyle/troubleshooting"), _("Troubleshooting"), 40)

    entry({"admin", "QOS", "qos_gargoyle", "troubleshooting", "data"},
        call("action_troubleshooting_data"))

    entry({"admin", "QOS", "qos_gargoyle", "load_data"},
        call("action_load_data")).leaf = true
end

function action_troubleshooting_data()
    local uci  = require "luci.model.uci".cursor()
    local i18n = require "luci.i18n"

    local data = {}

    local monenabled = uci:get("qos_gargoyle", "download", "qos_monenabled") or "false"

    local show_data = util.trim(util.exec("/etc/init.d/qos_gargoyle show 2>/dev/null"))
    if show_data == "" then
        show_data = i18n.translate("No data found")
    end

    data.show = show_data

    local mon_data
    if monenabled == "true" then
        mon_data = util.trim(util.exec("cat /tmp/qosmon.status 2>/dev/null"))

        if mon_data == "" then
            mon_data = i18n.translate("No data found")
        end
    else
        mon_data = i18n.translate("'Active Congestion Control' not enabled")
    end

    data.mon = mon_data

    http.prepare_content("application/json")
    http.write_json(data)
end

function action_load_data(type)
    local device
    if type == "download" then
        device = "ifb0"
    elseif type == "upload" then
        device = rv.wan[1].ifname
    end

    if device then
        local data
        if device ~= "" then
            data = util.exec("tc -s class show dev %s 2>/dev/null" % device)
        end
        http.prepare_content("text/plain")
        http.write(data or "")
    else
        http.status(500, "Bad address")
    end
end
