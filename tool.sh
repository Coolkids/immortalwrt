#!/bin/bash

function main(){
case $1 in
"feed")
	echo "update feed"
	feed
	echo "update feed finish"
	;;
"restore")
	echo "restore $2 config"
	restore_config $2
	;;
"save")
	echo "save $2 config"
	save_config $2
	;;
*)
	echo "param invalid"
	;;
esac
}

function feed(){
patchs=`pwd`
if [ -d "./tmp" ]; then
    rm -rf ./tmp
fi
rm -rf ./feeds/*
./scripts/feeds update -a
##禁用luci_app_attendedsysupgrade
pushd ./feeds/luci
git apply $patchs/patchs/0000-Revert-collections-Add-luciappattendedsysupgrade.patch
popd
#delete_dep
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/packages/net/v2ray-geodata
rm -rf ./feeds/packages/net/mosdns
rm -rf ./feeds/luci/applications/luci-app-unblockneteasemusic

# curl - http3/quic
rm -rf feeds/packages/net/curl
git clone https://github.com/sbwml/feeds_packages_net_curl feeds/packages/net/curl

sed -i '/^else ifeq (\$(ARCH),x86_64)$/a\
	PKG_SOURCE:=bandix-$(RUST_BANDIX_VERSION)-x86_64-unknown-linux-musl.tar.gz' "./feeds/custom/openwrt-bandix/openwrt-bandix/Makefile"
sed -i 's/--set=llvm\.download-ci-llvm=true/--set=llvm.download-ci-llvm=false/' ./feeds/packages/lang/rust/Makefile
./scripts/feeds install -a
./scripts/feeds install -p custom -f luci-app-passwall
./scripts/feeds install -p custom -f v2ray-geodata
./scripts/feeds install -p custom -f mosdns
}

function restore_config(){
cp ./configs/$1 .config
}
function save_config(){
cp .config ./configs/$1
}

main $1 $2
