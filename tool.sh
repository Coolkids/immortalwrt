#!/bin/bash

function main(){
case $1 in
"feed")
	echo "update feed"
	feed
	echo "update feed finish"
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
rm -rf ./feeds/diy1/naiveproxy

# curl - http3/quic
rm -rf feeds/packages/net/curl
git clone https://github.com/sbwml/feeds_packages_net_curl feeds/packages/net/curl

./scripts/feeds install -a
./scripts/feeds install -p diy2 -f luci-app-passwall
./scripts/feeds install -p custom -f v2ray-geodata
./scripts/feeds install -p mosdns -f mosdns


}


main $1
