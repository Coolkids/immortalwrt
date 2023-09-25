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
rm -rf ./feeds/*
./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/packages/net/v2ray-geodata
rm -rf ./feeds/packages/net/mosdns
rm -rf ./feeds/packages/net/nlbwmon
./scripts/feeds install -a
./scripts/feeds install -p diy2 luci-app-passwall
./scripts/feeds install -p custom v2ray-geodata
./scripts/feeds install -p custom nlbwmon
./scripts/feeds install -p mosdns mosdns
cd ./feeds/luci
git apply ../../.github/patch/001-luci-status-network-ifaces.patch
}

main $1