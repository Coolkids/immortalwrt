#
# Copyright (C) 2017 Xingwang Liao <kuoruan@gmail.com>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-qos-gargoyle
PKG_VERSION:=1.4.2
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Coolkid

LUCI_TITLE:=LuCI Support for Gargoyle QoS
LUCI_DEPENDS:=+qos-gargoyle
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/conffiles
/etc/config/qos_gargoyle
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
