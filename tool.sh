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
rm -rf ./feeds/*
./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/packages/net/v2ray-geodata
rm -rf ./feeds/packages/net/mosdns
./scripts/feeds install -a
./scripts/feeds install -p diy2 luci-app-passwall
./scripts/feeds install -p custom v2ray-geodata
./scripts/feeds install -p mosdns mosdns
pushd ./feeds/luci
git apply $patchs/patchs/001-luci-status-network-ifaces.patch
popd

}

main $1