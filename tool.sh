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
./scripts/feeds update -a
rm -rf ./feeds/luci/applications/luci-app-passwall
rm -rf ./feeds/packages/net/mosdns
./scripts/feeds install -a
./scripts/feeds install -p diy2 luci-app-passwall
./scripts/feeds install -p mosdns mosdns-v5
cd ./feeds/luci
git apply ../../.github/patch/001-luci-status-network-ifaces.patch
}

main $1