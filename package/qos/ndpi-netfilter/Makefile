#
# Copyright (C) 2010 OpenWrt.org
#
# This is free software, licensed under the GNU General Public License v2.
# See /LICENSE for more information.
#

include $(TOPDIR)/rules.mk
include $(INCLUDE_DIR)/kernel.mk

PKG_NAME:=ndpi-netfilter
PKG_VERSION:=d6e3b93
PKG_RELEASE:=$(AUTORELEASE)

PKG_SOURCE:=$(PKG_NAME)-$(PKG_VERSION).tar.gz
PKG_SOURCE_URL:=https://codeload.github.com/vel21ripn/nDPI/tar.gz/$(PKG_VERSION)?
PKG_HASH:=skip

PKG_BUILD_DIR:=$(KERNEL_BUILD_DIR)/nDPI-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/iptables-mod-ndpi
  SUBMENU:=Firewall
  SECTION:=net
  CATEGORY:=Network
  TITLE:=ndpi successor of OpenDPI
  URL:=http://www.ntop.org/products/ndpi/
  DEPENDS:=+iptables +iptables-mod-conntrack-extra +kmod-ipt-ndpi
  MAINTAINER:=Thomas Heil <heil@terminal-consulting.de>
endef

define Package/iptables-mod-ndpi/description
  nDPI is a ntop-maintained superset of the popular OpenDPI library
endef

CONFIGURE_CMD=./autogen.sh
CONFIGURE_ARGS += --with-pic

MAKE_PATH:=ndpi-netfilter

MAKE_FLAGS += \
	KERNEL_DIR="$(LINUX_DIR)" \
	MODULES_DIR="$(TARGET_MODULES_DIR)" \
	NDPI_PATH=$(PKG_BUILD_DIR)/ndpi-netfilter

define Build/Compile
	make $(MAKE_FLAGS) -C $(PKG_BUILD_DIR)/ndpi-netfilter
endef

define Package/iptables-mod-ndpi/install
	$(INSTALL_DIR) $(1)/usr/lib/iptables
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/ndpi-netfilter/ipt/libxt_ndpi.so $(1)/usr/lib/iptables
endef

define KernelPackage/ipt-ndpi
  SUBMENU:=Netfilter Extensions
  TITLE:= nDPI net netfilter module
  DEPENDS:=+kmod-nf-conntrack +kmod-nf-conntrack-netlink +kmod-ipt-compat-xtables +kmod-ipt-conntrack-label
  FILES:= \
	$(PKG_BUILD_DIR)/ndpi-netfilter/src/xt_ndpi.ko
  AUTOLOAD:=$(call AutoProbe,xt_ndpi)
endef

$(eval $(call BuildPackage,iptables-mod-ndpi))
$(eval $(call KernelPackage,ipt-ndpi))

