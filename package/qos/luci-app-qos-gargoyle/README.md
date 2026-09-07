# luci-app-qos-gargoyle

This is my own fork of QoS Gargoyle

QoS Gargoyle: https://github.com/kuoruan/qos-gargoyle

The LuCI frontend uses the current JavaScript view API. Configuration remains
backwards compatible with `/etc/config/qos_gargoyle`; the shaping backend is
still provided by the separate `qos-gargoyle` package.

The interface is available under `Network -> Gargoyle QoS` with separate
Global, Upload, Download and Status views. Upload and download classes and
classification rules are edited through standard LuCI grid sections and
modal dialogs.
